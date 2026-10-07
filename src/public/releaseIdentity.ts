import { publicReleaseIdentity } from './generated/releaseIdentity.js';
import { sha256Hex } from '../evidence/canonical.js';

export async function observedPublicRelease(manifest: unknown, releaseSha?: string) {
  const manifestDigest = manifest ? await sha256Hex(manifest) : null;
  const sourceBound = publicReleaseIdentity.sourceClean && releaseSha === publicReleaseIdentity.sourceSha;
  const manifestBound = manifestDigest === publicReleaseIdentity.manifestDigest;
  return { ...publicReleaseIdentity, observedManifestDigest: manifestDigest,
    sourceBinding: sourceBound && manifestBound ? 'BOUND' : 'UNVERIFIED',
    deploymentBinding: 'REQUIRES_DEPLOYMENT_RECEIPT' };
}
