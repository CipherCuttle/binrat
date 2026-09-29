import { getAddress, isAddress } from 'viem';

export interface PublicationSurface {
  id: string;
  content: string;
}

export interface PublicationCheck {
  id: string;
  status: 'PASS' | 'BLOCKED';
  detail: string;
}

const ADDRESS = /0x[a-fA-F0-9]{40}/g;

/**
 * Checks the text that would be published; it neither edits nor contacts a surface.
 * Before verification every surface must contain no EVM address. Afterward every
 * address seen must be the independently supplied canonical receipt address.
 */
export function checkTokenPublication(input: {
  state: 'NOT_LAUNCHED' | 'PUBLICATION_ELIGIBLE' | 'TOKEN_LIVE';
  canonicalContractAddress: string | null;
  surfaces: readonly PublicationSurface[];
}): PublicationCheck[] {
  if (input.surfaces.length === 0) throw new Error('PUBLICATION_SURFACES_REQUIRED');
  if (new Set(input.surfaces.map((surface) => surface.id)).size !== input.surfaces.length) {
    throw new Error('PUBLICATION_SURFACE_ID_DUPLICATE');
  }
  const prelaunch = input.state === 'NOT_LAUNCHED';
  if (prelaunch && input.canonicalContractAddress !== null) throw new Error('PUBLICATION_PRELAUNCH_CA_FORBIDDEN');
  if (!prelaunch && (!input.canonicalContractAddress || !isAddress(input.canonicalContractAddress, { strict: false }))) {
    throw new Error('PUBLICATION_CANONICAL_CA_REQUIRED');
  }
  const canonical = input.canonicalContractAddress ? getAddress(input.canonicalContractAddress).toLowerCase() : null;
  return input.surfaces.map((surface) => {
    const found = surface.content.match(ADDRESS) ?? [];
    const normalized = found.map((address) => getAddress(address).toLowerCase());
    const correct = prelaunch
      ? normalized.length === 0
      : normalized.length > 0 && normalized.every((address) => address === canonical);
    return { id: surface.id, status: correct ? 'PASS' : 'BLOCKED', detail: prelaunch ? `addresses=${normalized.length}` : `addresses=${normalized.length} canonical=${canonical}` };
  });
}
