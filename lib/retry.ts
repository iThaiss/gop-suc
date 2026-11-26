export type Attempt = { signature:string; key:string };

export function requestAttempt(data:object,previous:Attempt|null):Attempt {
  const signature=JSON.stringify(data);
  if(previous?.signature===signature) return previous;
  const key=Array.from(crypto.getRandomValues(new Uint8Array(32)), byte=>byte.toString(16).padStart(2,"0")).join("");
  return {signature,key};
}
