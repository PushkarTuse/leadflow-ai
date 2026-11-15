// Private subprocess transport: request data arrives on stdin, never command-line arguments.
let input='';
for await (const chunk of process.stdin) input+=chunk;
try {
  const {url,request={}}=JSON.parse(input);
  if(!/^https:\/\/(hacker-news\.firebaseio\.com|generativelanguage\.googleapis\.com|api\.telegram\.org)\//.test(url)
    && !/^http:\/\/127\.0\.0\.1:8787\/leads\?/.test(url))throw new Error('Host blocked');
  const response=await fetch(url,{method:request.method||'get',headers:{'Content-Type':'application/json',...request.headers},
    ...(request.body===undefined?{}:{body:JSON.stringify(request.body)}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const text=await response.text();if(text.length>1000000)throw new Error('Response too large');
  process.stdout.write(JSON.stringify(JSON.parse(text)));
} catch {process.stderr.write('Provider request failed (redacted)');process.exitCode=1;}
