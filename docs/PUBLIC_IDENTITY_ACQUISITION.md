# BINRAT PUBLIC IDENTITY ACQUISITION V0

## Objective

Prepare BINRAT to claim a public domain and social handle without accidentally presenting an unowned target as official.

This document deliberately does **not** name the current acquisition targets. Candidate names are kept out of the public repository until ownership is verified, because publishing an unclaimed target can encourage squatting.

## Current state

- custom domain: **NOT VERIFIED OWNED**
- X/social handle: **NOT VERIFIED OWNED**
- canonical public host: temporary Render prelaunch host only
- token: **NOT LIVE**
- contract: **NOT PUBLISHED**

## Ownership law

A domain or social handle may be presented as official only after ownership/control is independently verified.

For a domain, acceptable evidence is control of DNS or an equivalent authenticated registrar action plus successful resolution to the BINRAT deployment.

For a social handle, acceptable evidence is successful authenticated control of the account/handle and a profile state that matches the BINRAT identity.

A public search result, RDAP 404, X 404, or other apparent-availability signal is **not ownership**.

## Publication law

Before ownership is verified, the public site must not:

- link to an X/social handle as official;
- publish a custom domain as canonical;
- emit an external `og:url` or canonical URL for an unowned domain;
- claim that a candidate domain/handle is reserved, secured, owned, or official;
- redirect users to an unverified identity target.

The acquisition targets remain out-of-band until verified.

## After acquisition

Once ownership is verified, one bounded release may:

1. record the acquired domain and social handle in this document;
2. add the official links to the public site;
3. set canonical/Open Graph URLs to the owned domain;
4. verify DNS/HTTP resolution and the social profile;
5. keep `$BINRAT NOT LIVE` and `NO CONTRACT PUBLISHED` unless separately authorized to change them.

## Hard boundary

Identity acquisition does not authorize:

- token launch;
- contract publication;
- wallet connection;
- presale;
- trading/signing;
- transaction submission;
- capital deployment;
- live evidence-feed activation.
