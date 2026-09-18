import type { LaunchObservationReceipt } from './types.js';

export interface ObservationStore {
  putObservation(receipt: LaunchObservationReceipt): Promise<'INSERTED' | 'DUPLICATE'>;
  listObservationsForLaunch(launchId: string): Promise<LaunchObservationReceipt[]>;
}
