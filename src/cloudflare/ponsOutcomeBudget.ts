import type { PonsOutcomeObservationSource } from '../pons/outcomeReceipts.js';

/** One cycle, no hidden transport retries; shared by discovery and archive clients. */
export class OutcomeWorkBudget {
  readonly controller=new AbortController();
  private readonly deadline:number;
  private calls=0;
  private steps=0;
  private readonly timer:ReturnType<typeof setTimeout>;
  constructor(private readonly now:()=>number,ms:number,private readonly maxCalls:number,private readonly authorize:()=>Promise<void>) {
    this.deadline=now()+ms;
    this.timer=setTimeout(()=>this.controller.abort(),ms);
  }
  get rpcCalls():number {return this.calls;}
  stop():void {this.controller.abort();clearTimeout(this.timer);}
  async check():Promise<void> {
    if (this.controller.signal.aborted || this.now()>=this.deadline) throw new Error('PONS_OUTCOME_TIME_BUDGET');
    await this.authorize();
    if (this.controller.signal.aborted || this.now()>=this.deadline) throw new Error('PONS_OUTCOME_TIME_BUDGET');
  }
  fetch(impl:typeof fetch):typeof fetch {
    return async(input,init)=>{
      await this.check();
      if (this.calls>=this.maxCalls) throw new Error('PONS_OUTCOME_RPC_BUDGET');
      const body=typeof init?.body==='string' ? JSON.parse(init.body) : null;
      if (!body || Array.isArray(body) || !['eth_chainId','eth_getCode','eth_getBlockByNumber','eth_call'].includes(body.method)) {
        throw new Error('PONS_OUTCOME_RPC_METHOD_INVALID');
      }
      this.calls++;
      const signal=AbortSignal.any([this.controller.signal,AbortSignal.timeout(3000),...(init?.signal?[init.signal]:[])]);
      const response=await impl(input,{...init,signal});
      await this.check();
      return response;
    };
  }
  source(raw:PonsOutcomeObservationSource):PonsOutcomeObservationSource {
    const run=async<T>(fn:()=>Promise<T>):Promise<T>=>{
      await this.check();
      if (++this.steps>64) throw new Error('PONS_OUTCOME_STEP_BUDGET');
      // Injected fixture sources may ignore AbortSignal; never proceed after a timeout.
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        const value=await Promise.race([fn(),new Promise<never>((_,reject)=>{
          timer=setTimeout(()=>reject(new Error('PONS_OUTCOME_TIME_BUDGET')),Math.max(1,this.deadline-this.now()));
        })]);
        await this.check();return value;
      } finally {if(timer) clearTimeout(timer);}
    };
    return {
      assertAuthority:()=>run(()=>raw.assertAuthority()),
      getBlockPoint:n=>run(async()=>{
        const p=await raw.getBlockPoint(n);
        if (p.blockNumber!==n || !/^0x[0-9a-f]{64}$/i.test(p.blockHash) || !Number.isSafeInteger(p.timestampMs) || p.timestampMs<0) throw new Error('PONS_OUTCOME_BLOCK_INVALID');
        return p;
      }),
      readOutcomeAt:(launch,n)=>run(()=>raw.readOutcomeAt(launch,n))
    };
  }
}
