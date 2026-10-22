export function GET(){return Response.json({service:"psg-ai",status:"ready",executionEnabled:process.env.PSG_AI_EXECUTION_ENABLED==="true"},{headers:{"cache-control":"no-store"}});}
