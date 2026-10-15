/**
 * Completely unmounted, network-denied Tripwire runner.
 * It composes owner consent, durable bounded stream accounting, exact
 * WebSocket hints and six-read canonical proof without opening a socket.
 * Only an offline test double is accepted; no scheduler, no Case/Telegram.
 */
import { BudgetLedger } from './budget.js';
import { PersistentTripwireWatch, PERSISTENT_TRIPWIRE_SCHEMA,
  PONS_TOKEN_LAUNCHED_TOPIC, type IntakeResult, type TripwireSql } from './persistentTripwireWatch.js';
import { proveQueuedTripwireHint, type TripwireProofResult,
  type TripwireProofWire } from './persistentTripwireProof.js';

export interface OfflineTripwirePort extends TripwireProofWire {
  readonly live: false;
  readonly mode: 'OFFLINE_FIXTURE_ONLY';
}
export interface OfflineTripwireScope {
  generation: string; ownerId: string; deployer: string; startBlock: number;
  grantId: string; stopsAtMs: number; subscriptionId: string;
}
export interface RunnerOptions {
  db: TripwireSql; ledger: BudgetLedger; now?: () => number;
  /** Explicit test capability, never accepted as production authorization. */
  offlineFixtureOnly: true;
}
export class OfflinePersistentTripwireRunner {
  private readonly intake: PersistentTripwireWatch;
  private readonly now: () => number;
  private current: OfflineTripwireScope | null = null;
  private busy=false;
  constructor(private readonly options: RunnerOptions){
    if(options.offlineFixtureOnly!==true)throw Error('TRIPWIRE_RUNNER_LIVE_DENIED');
    this.now=options.now??Date.now;
    options.db.exec(PERSISTENT_TRIPWIRE_SCHEMA);
    this.intake=new PersistentTripwireWatch(options.db,this.now);
  }
  /** Caller owns exclusive writer lock and the already persisted owner consent.
   * This reserves worst-case WS + setup cost before any hint can be received.
   * No WebSocket connection or API request is performed. */
  start(scope: OfflineTripwireScope,
    admission: {job:string;deadline:number;exclusiveWriter:true}):void{
    if(this.current||this.busy||admission.exclusiveWriter!==true)throw Error('TRIPWIRE_RUNNER_UNAVAILABLE');
    this.options.ledger.reserveTripwireStream(admission.job,scope.grantId,admission.deadline,{
      ownerId:scope.ownerId,generation:scope.generation,deployer:scope.deployer
    });
    try {
      this.intake.arm({
        generation:scope.generation,ownerId:scope.ownerId,deployer:scope.deployer,
        startBlock:scope.startBlock,stopsAtMs:scope.stopsAtMs,
        subscriptionId:scope.subscriptionId,eventTopic:PONS_TOKEN_LAUNCHED_TOPIC,approved:true
      });
      this.current=Object.freeze({...scope});
    } catch(error){
      this.options.ledger.stopTripwireStream(scope.grantId);
      throw error;
    }
  }
  /** One delivered frame, counted before validation (including duplicates).
   * Invalid frame, stream cap breach, removal or reorg quarantine ends intake. */
  receive(frame:unknown):IntakeResult{
    const scope=this.current;
    if(!scope||this.now()>=scope.stopsAtMs) {
      if(scope)this.stop(false);
      throw Error('TRIPWIRE_RUNNER_INACTIVE');
    }
    let size:number;
    try {
      size=Buffer.byteLength(JSON.stringify(frame));
      if(!Number.isSafeInteger(size))throw Error('TRIPWIRE_FRAME_INVALID');
    } catch {
      this.stop(false);throw Error('TRIPWIRE_FRAME_INVALID');
    }
    try{
      this.options.ledger.chargeTripwireStreamFrame(scope.grantId,{
        ownerId:scope.ownerId,generation:scope.generation,deployer:scope.deployer
      },size);
      const result=this.intake.ingest(scope.generation,frame);
      if(result==='REORG_UNKNOWN'||result==='CONFLICT_UNKNOWN'||result==='OVERFLOW_UNKNOWN'){
        this.stop(false);
      }
      return result;
    }catch{
      this.stop(false);
      throw Error('TRIPWIRE_RUNNER_FRAME_REJECTED');
    }
  }
  /** One candidate job only. A hint alone has no proof or notification authority.
   * No intervals are called covered, even after successful positive proof. */
  async proveNext(input:{
    job:string;deadline:number;wire:OfflineTripwirePort;exclusiveWriter:true
  }):Promise<TripwireProofResult|null>{
    const scope=this.current;
    if(!scope||this.busy||input.exclusiveWriter!==true||
      input.wire?.live!==false||input.wire.mode!=='OFFLINE_FIXTURE_ONLY'||
      this.now()>=scope.stopsAtMs)throw Error('TRIPWIRE_RUNNER_NOT_OFFLINE');
    this.busy=true;
    try {
      return await proveQueuedTripwireHint({
        db:this.options.db,ledger:this.options.ledger,job:input.job,
        grantId:scope.grantId,deadline:input.deadline,
        generation:scope.generation,wire:input.wire,now:this.now
      });
    }finally{this.busy=false;}
  }
  /** No automatic reconnect: UNKNOWN never becomes VERIFIED by silence. */
  stop(terminal=true):void{
    if(!this.current)return;
    const scope=this.current;
    this.current=null;
    this.intake.close(scope.generation,terminal);
    this.options.ledger.stopTripwireStream(scope.grantId);
  }
  recover(exclusiveWriter:true,grantId:string):void{
    if(exclusiveWriter!==true||this.current)throw Error('TRIPWIRE_RECOVERY_LOCK_REQUIRED');
    this.intake.recoverAfterRestart(true);
    this.options.ledger.stopTripwireStream(grantId);
  }
  status(generation:string){
    return this.intake.status(generation);
  }
}
