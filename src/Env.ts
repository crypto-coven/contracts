export const OPEN_SEA_PROXY_REGISTRY_ADDRESSES = {
  mainnet: "0xa5409ec958c83c3f309868babaca7c86dcb077c1",
  rinkeby: "0xf57b2c51ded3a29e6891aba85459d600256cf317",
};

export const OPEN_SEA_PROXY_REGISTRY_ADDRESS =
  process.env.NODE_ENV === "development"
    ? OPEN_SEA_PROXY_REGISTRY_ADDRESSES.rinkeby
    : OPEN_SEA_PROXY_REGISTRY_ADDRESSES.mainnet;

export const WITCHES_CONTRACT_ADDRESS = process.env.WITCHES_CONTRACT_ADDRESS;
