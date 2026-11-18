/** Network failures are not evidence that a financial write failed to commit. */
export const intakeRequestTimeout = {queue:45_000, command:60_000} as const;
export class IntakeRequestError extends Error {}
export function intakeRequestError(error:unknown, context:'queue'|'preview'|'write'):string {
 if(error instanceof IntakeRequestError)return error.message;
 const timedOut=error instanceof Error && (error.name==='TimeoutError'||error.name==='AbortError');
 if(context==='queue')return timedOut
  ? 'Loading the receipt queue took too long. Select Refresh queue to try again. Your statement choices are kept.'
  : 'The receipt queue could not be loaded. Select Refresh queue to try again. Your statement choices are kept.';
 if(context==='preview')return timedOut
  ? 'Checking the statement took too long. Your file and column choices are kept. Select Preview receipts to try again.'
  : 'The statement preview could not be completed. Your file and column choices are kept. Select Preview receipts to try again.';
 return 'We could not confirm the result. Refresh the queue and check Fees & receipts before trying again; the action may already have completed. Your statement choices are kept.';
}
