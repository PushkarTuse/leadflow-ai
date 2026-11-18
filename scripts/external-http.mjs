// Private subprocess transport: request data arrives on stdin, never command-line arguments.
let input='';
for await (const chunk of process.stdin) input+=chunk;
// Only a safe, credential-free detail is ever written to stderr:
// the HTTP status, a network error code, or a fixed reason. Never the URL,
// headers, body, response text or token.
let detail='request failed';
try {
  const {url,request={}}=JSON.parse(input);
  let aiEndpoint='';
  if(process.env.AI_ENABLED==='true'&&
    process.env.AI_PROVIDER==='openai'&&process.env.AI_DATA_USE_APPROVED==='true'){
    try{
      const base=new URL(process.env.AI_API_BASE_URL||'https://api.openai.com/v1');
      const host=base.hostname.toLowerCase();
      const privateIpv4=/^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
      if(base.protocol==='https:'&&host.includes('.')&&!['localhost'].includes(host)&&
        !/\.(?:localhost|local|internal)$/i.test(host)&&!privateIpv4&&
        !/^\[?(?:[\da-f]*:){2,}[\da-f:]*\]?$/i.test(host)&&!base.username&&!base.password&&
        !base.port&&!base.search&&!base.hash&&!base.pathname.split('/').some(part=>part==='.'||part==='..')){
        aiEndpoint=`${base.origin}${base.pathname.replace(/\/+$/,'')}/chat/completions`;
      }
    }catch{}
  }
  if(!/^https:\/\/(hacker-news\.firebaseio\.com|generativelanguage\.googleapis\.com|api\.telegram\.org)\//.test(url)
    && !/^http:\/\/127\.0\.0\.1:8787\/leads\?/.test(url)
    && !(aiEndpoint&&url===aiEndpoint)){detail='host blocked';throw new Error('Host blocked');}
  const response=await fetch(url,{method:request.method||'get',headers:{'Content-Type':'application/json',...request.headers},
    ...(request.body===undefined?{}:{body:JSON.stringify(request.body)}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok){detail='HTTP '+response.status;throw new Error('HTTP '+response.status);}
  const text=await response.text();
  if(text.length>1000000){detail='response too large';throw new Error('Response too large');}
  try{process.stdout.write(JSON.stringify(JSON.parse(text)));}
  catch{detail='invalid JSON response';throw new Error('Invalid JSON response');}
} catch (error) {
  if(detail==='request failed'){
    const cause=error&&typeof error==='object'?error.cause:undefined;
    if(cause&&typeof cause==='object'&&typeof cause.code==='string')detail=cause.code;
  }
  process.stderr.write(`Provider request failed (${detail})`);
  process.exitCode=1;
}
