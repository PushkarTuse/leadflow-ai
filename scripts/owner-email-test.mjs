// Private subprocess transport for the owner-only verification receipt.
// Credentials arrive on stdin and are never placed on the command line.
import net from 'node:net';
import tls from 'node:tls';
import {randomUUID} from 'node:crypto';

let input='';
for await (const chunk of process.stdin) input+=chunk;

let socket;
let next;
let reply;

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

try{
  const {smtpUrl,from,to,subject,text}=JSON.parse(input);
  const url=new URL(smtpUrl);
  if(url.protocol!=='smtp:'&&url.protocol!=='smtps:')throw new Error('protocol');
  const host=url.hostname;
  const port=Number(url.port||(url.protocol==='smtps:'?'465':'587'));
  const user=decodeURIComponent(url.username||'');
  const pass=decodeURIComponent(url.password||'');
  const secure=url.protocol==='smtps:';

  const base=await new Promise((resolve,reject)=>{
    const stream=secure
      ?tls.connect({host,port,servername:host},()=>resolve(stream))
      :net.connect({host,port},()=>resolve(stream));
    stream.setTimeout(20000,()=>{stream.destroy();reject(new Error('timeout'));});
    stream.once('error',reject);
  });
  attach(base);

  let response=await reply();
  if(response.code!==220)throw new Error('greeting');

  response=await command('EHLO leadflow.local');
  if(response.code!==250)throw new Error('ehlo');

  if(!secure&&/STARTTLS/i.test(response.text)){
    response=await command('STARTTLS');
    if(response.code!==220)throw new Error('starttls');
    const upgraded=await new Promise((resolve,reject)=>{
      const stream=tls.connect({socket:base,servername:host},()=>resolve(stream));
      stream.setTimeout(20000,()=>{stream.destroy();reject(new Error('timeout'));});
      stream.once('error',reject);
    });
    attach(upgraded);
    response=await command('EHLO leadflow.local');
    if(response.code!==250)throw new Error('ehlo-tls');
  }

  if(user){
    response=await command('AUTH LOGIN');
    if(response.code!==334)throw new Error('auth');
    response=await command(Buffer.from(user).toString('base64'));
    if(response.code!==334)throw new Error('auth-user');
    response=await command(Buffer.from(pass).toString('base64'));
    if(response.code!==235)throw new Error('auth-pass');
  }

  response=await command(`MAIL FROM:<${from}>`);
  if(response.code!==250)throw new Error('mail-from');

  response=await command(`RCPT TO:<${to}>`);
  if(response.code!==250&&response.code!==251)throw new Error('rcpt');

  response=await command('DATA');
  if(response.code!==354)throw new Error('data');

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
  if(response.code!==250)throw new Error('queued');

  try{await command('QUIT');}catch{/* server may close first */}
  socket.destroy();
  process.stdout.write(JSON.stringify({ok:true,messageId}));
}catch{
  try{socket?.destroy();}catch{/* ignore */}
  process.stderr.write('Owner email test failed (redacted)');
  process.exitCode=1;
}
