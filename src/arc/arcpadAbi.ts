import { parseAbiItem } from 'viem';

export const tokenCreatedEvent = parseAbiItem(
  'event TokenCreated(address indexed token,address indexed creator,string name,string symbol,address pool,string imageURI,string website,string twitter,string telegram)'
);
