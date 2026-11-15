// Private subprocess transport for the owner-only verification receipt.
// Credentials arrive on stdin and are never placed on the command line.
// Failures report the SMTP stage and response code only — never the password,
// the username or the full SMTP URL.
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

const guard=setTimeout(()=>{
  try{socket?.destroy();}catch{/* ignore */}
  process.stdout.write(JSON.stringify({ok:false,stage:'timeout',code:0,message:'no response within 25 seconds'}));
  process.exit(1);
},25000);

try{
  const {smtpUrl,from,to,subject,text}=JSON.parse(input);
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

  if(!secure&&/STARTTLS/i.test(response.text)){
    response=await command('STARTTLS');
    if(response.code!==220)throw fail('starttls',response.code,'STARTTLS rejected');
    const upgraded=tls.connect({socket:base,servername:host});
    attach(upgraded);
    await connect(upgraded,'secureConnect','starttls');
    response=await command('EHLO leadflow.local');
    if(response.code!==250)throw fail('ehlo-tls',response.code,'EHLO after STARTTLS rejected');
  }

  if(user){
    response=await command('AUTH LOGIN');
    if(response.code!==334)throw fail('auth',response.code,'AUTH LOGIN rejected');
    response=await command(Buffer.from(user).toString('base64'));
    if(response.code!==334)throw fail('auth-user',response.code,'username rejected');
    response=await command(Buffer.from(pass).toString('base64'));
    if(response.code!==235)throw fail('auth-pass',response.code,'credentials rejected');
  }

  response=await command(`MAIL FROM:<${from}>`);
  if(response.code!==250)throw fail('mail-from',response.code,'sender rejected');

  response=await command(`RCPT TO:<${to}>`);
  if(response.code!==250&&response.code!==251)throw fail('rcpt',response.code,'recipient rejected');

  response=await command('DATA');
  if(response.code!==354)throw fail('data',response.code,'DATA rejected');

  const messageId=`<${randomUUID()}@leadflow.local>`;
  const body=[
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
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
