export function validatePublicProduct(product) {
  const ids = ["rat-zero", "tripwire", "sniffer", "working-rat", "den", "locked-1", "locked-2"];
  const stages = ["LIVE", "BUILDING", "PROVING", "PLANNED", "LOCKED", "UNVERIFIED"];
  if (product?.schemaVersion !== "binrat.public-product/1" || product.mappingRevision !== "BINRAT_LAUNCH_PUBLIC_MAPPING_V1" ||
      !/^[0-9a-f]{64}$/.test(product.manifestDigest) || product.currentAuthority?.chainId !== 4663 ||
      typeof product.launchState?.status !== 'string' || typeof product.launchState?.tokenState !== 'string' ||
      product.launchState?.marketingAuthorized !== false || product.launchState?.launchAuthorized !== false ||
      product.currentWatch?.employmentAvailable !== false ||
      ![false,null].includes(product.workingRat?.productionEntitlementActive) ||
      !Array.isArray(product.crew) || product.crew.length !== ids.length ||
      product.crew.some((rat, index) => rat?.id !== ids[index] || typeof rat.name !== "string" || typeof rat.role !== "string" ||
        typeof rat.description !== "string" || !stages.includes(rat.status) || typeof rat.actionAvailable !== "boolean" ||
        (rat.actionAvailable && (rat.id !== "rat-zero" || rat.status !== "LIVE" || !product.snapshotBinding))) ||
      !Array.isArray(product.todayJourney) || !Array.isArray(product.futureWorkforceLoop) || !Array.isArray(product.roadmap)) {
    throw new Error("PUBLIC_PRODUCT_INVALID");
  }
  return product;
}
