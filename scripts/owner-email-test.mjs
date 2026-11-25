// Private subprocess transport for the owner-only verification receipt.
// Credentials arrive on stdin and are never placed on the command line.
// Failures report the SMTP stage and response code only — never the password,
// the username or the full SMTP URL.
//
// Provider-neutral: the host, port, TLS mode and credentials all come from the
// OWNER_TEST_SMTP_URL value. Nothing here knows about any specific provider.
import net from 'node:net';
import tls from 'node:tls';
import {randomUUID} from 'node:crypto';

let input='';
for await (const chunk of process.stdin) input+=chunk;

let socket;
let next;
let reply;

function fail(stage,code,message){
  const error=new Error(message);
  error.stage=stage;
  error.code=code;
  return error;
}

/** A bare % in a password would make decodeURIComponent throw; fall back to the raw value. */
function decode(value){
  try{return decodeURIComponent(value);}catch{return value;}
}

function attach(stream){
  if(socket&&socket._lfHandler)socket.removeListener('data',socket._lfHandler);
  socket=stream;
  let buffer='';
  const queue=[];
  let waiter=null;
  const handler=(chunk)=>{
    buffer+=chunk.toString('utf8');
    let index;
    while((index=buffer.indexOf('\r\n'))>=0){
      const line=buffer.slice(0,index);
      buffer=buffer.slice(index+2);
      if(waiter){const resume=waiter;waiter=null;resume(line);}else queue.push(line);
    }
  };
  stream._lfHandler=handler;
  stream.on('data',handler);
  next=()=>new Promise((resolve)=>{if(queue.length)resolve(queue.shift());else waiter=resolve;});
  reply=async()=>{
    const lines=[];
    for(;;){
      const line=await next();
      lines.push(line);
      if(/^\d{3} /.test(line))return {code:Number(line.slice(0,3)),text:lines.join('\n')};
    }
  };
}

async function command(line){
  socket.write(line+'\r\n');
  return reply();
}

function connect(stream,event,stage){
  return new Promise((resolve,reject)=>{
    stream.setTimeout(20000,()=>{stream.destroy();reject(fail(stage,0,'connection timed out'));});
    stream.once(event,()=>resolve(stream));
    stream.once('error',(error)=>reject(fail(stage,0,error.code||'connection failed')));
  });
}

/** Reads the AUTH mechanisms advertised in an EHLO response. Provider-neutral. */
function authMechanisms(text){
  const found=new Set();
  for(const line of text.split('\n')){
    const match=line.match(/^\d{3}[ -]AUTH[ =](.+)$/i);
    if(match)for(const token of match[1].trim().split(/\s+/))found.add(token.toUpperCase());
  }
  return found;
}

const guard=setTimeout(()=>{
  try{socket?.destroy();}catch{/* ignore */}
  process.stdout.write(JSON.stringify({ok:false,stage:'timeout',code:0,message:'no response within 25 seconds'}));
  process.exit(1);
},25000);

try{
  const {smtpUrl,from,to,subject,text,html,replyTo,displayName}=JSON.parse(input);
  const mailbox=/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
  if(!mailbox.test(from)||!mailbox.test(to)||(replyTo&&!mailbox.test(replyTo))
    ||typeof subject!=='string'||/[\r\n]/.test(subject)||typeof text!=='string'
    ||(displayName&&(typeof displayName!=='string'||/[\r\n]/.test(displayName)))
    ||(html!=null&&typeof html!=='string'))throw fail('config',0,'invalid message fields');
  const url=new URL(smtpUrl);
  if(url.protocol!=='smtp:'&&url.protocol!=='smtps:')throw fail('config',0,'unsupported protocol');
  const host=url.hostname;
  const port=Number(url.port||(url.protocol==='smtps:'?'465':'587'));
  const user=decode(url.username||'');
  const pass=decode(url.password||'');
  const secure=url.protocol==='smtps:';

  const base=secure?tls.connect({host,port,servername:host}):net.connect({host,port});
  attach(base);
  await connect(base,secure?'secureConnect':'connect','connect');

  let response=await reply();
  if(response.code!==220)throw fail('greeting',response.code,'unexpected greeting');

  response=await command('EHLO leadflow.local');
  if(response.code!==250)throw fail('ehlo',response.code,'EHLO rejected');
  let ehlo=response.text;

  if(!secure){
    if(!/STARTTLS/i.test(ehlo))throw fail('starttls',0,'SMTP server did not advertise STARTTLS');
    response=await command('STARTTLS');
    if(response.code!==220)throw fail('starttls',response.code,'STARTTLS rejected');
    const upgraded=tls.connect({socket:base,servername:host});
    attach(upgraded);
    await connect(upgraded,'secureConnect','starttls');
    response=await command('EHLO leadflow.local');
    if(response.code!==250)throw fail('ehlo-tls',response.code,'EHLO after STARTTLS rejected');
    ehlo=response.text;
  }

  if(user){
    const mechanisms=authMechanisms(ehlo);
    if(mechanisms.size&&!mechanisms.has('LOGIN')&&!mechanisms.has('PLAIN'))
      throw fail('auth',0,'no supported AUTH mechanism offered');
    if(mechanisms.has('PLAIN')&&!mechanisms.has('LOGIN')){
      response=await command('AUTH PLAIN');
      if(response.code!==334)throw fail('auth',response.code,'AUTH PLAIN rejected');
      response=await command(Buffer.from(`\0${user}\0${pass}`).toString('base64'));
      if(response.code!==235)throw fail('auth-pass',response.code,'credentials rejected');
    }else{
      response=await command('AUTH LOGIN');
      if(response.code!==334)throw fail('auth',response.code,'AUTH LOGIN rejected');
      response=await command(Buffer.from(user).toString('base64'));
      if(response.code!==334)throw fail('auth-user',response.code,'username rejected');
      response=await command(Buffer.from(pass).toString('base64'));
      if(response.code!==235)throw fail('auth-pass',response.code,'credentials rejected');
    }
  }

  response=await command(`MAIL FROM:<${from}>`);
  if(response.code!==250)throw fail('mail-from',response.code,'sender rejected');

  response=await command(`RCPT TO:<${to}>`);
  if(response.code!==250&&response.code!==251)throw fail('rcpt',response.code,'recipient rejected');

  response=await command('DATA');
  if(response.code!==354)throw fail('data',response.code,'DATA rejected');

  const messageId=`<${randomUUID()}@leadflow.local>`;
  const encode=value=>`=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
  const boundary=`leadflow-${randomUUID()}`;
  const part=(value,type)=>[`Content-Type: text/${type}; charset=utf-8`,'Content-Transfer-Encoding: base64','',
    Buffer.from(value).toString('base64').match(/.{1,76}/g)?.join('\r\n')??''];
  const body=[
    `From: ${displayName?encode(displayName)+' ':''}<${from}>`,
    `To: ${to}`,
    ...(replyTo?[`Reply-To: ${replyTo}`]:[]),
    `Subject: ${encode(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    ...(html?[`Content-Type: multipart/alternative; boundary="${boundary}"`,'',`--${boundary}`,
      ...part(text,'plain'),`--${boundary}`,...part(html,'html'),`--${boundary}--`]:part(text,'plain')),
  ].join('\r\n');
  socket.write(body.split('\r\n').map((line)=>line.startsWith('.')?'.'+line:line).join('\r\n')+'\r\n.\r\n');

  response=await reply();
  if(response.code!==250)throw fail('queued',response.code,'message not accepted');

  try{await command('QUIT');}catch{/* server may close first */}
  socket.destroy();
  clearTimeout(guard);
  process.stdout.write(JSON.stringify({ok:true,messageId}));
}catch(error){
  clearTimeout(guard);
  try{socket?.destroy();}catch{/* ignore */}
  const detail=error&&typeof error==='object'?error:{};
  process.stdout.write(JSON.stringify({
    ok:false,
    stage:String(detail.stage||'unknown'),
    code:Number(detail.code||0),
    message:String(detail.message||'failed').slice(0,120),
  }));
  process.exitCode=1;
}
