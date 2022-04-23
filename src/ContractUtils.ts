import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { CryptoCoven } from "../typechain";

import { OPEN_SEA_PROXY_REGISTRY_ADDRESS } from "./Env";
import { WITCHES_CONTRACT_NAME } from "./contractConstants";

type ContractType = CryptoCoven;

export type CryptoCovenDeployArgs = {
  maxTokens: number;
  maxCommunitySaleTokens: number;
  maxGiftedTokens: number;
};
export interface ContractUtils<TContract extends ContractType, TArgs> {
  deploy(args: TArgs): Promise<TContract>;

  attach(contractAddress: string): TContract;
}

export async function getCryptoCoven(): Promise<
  ContractUtils<CryptoCoven, CryptoCovenDeployArgs>
> {
  const Contract = await ethers.getContractFactory(WITCHES_CONTRACT_NAME);
  return {
    deploy: async (args: CryptoCovenDeployArgs) => {
      const { maxTokens, maxCommunitySaleTokens, maxGiftedTokens } = args;
      // Deploy a new smart contract, connected to the first signer by default
      const contract = await Contract.deploy(
        OPEN_SEA_PROXY_REGISTRY_ADDRESS,
        maxTokens,
        maxCommunitySaleTokens,
        maxGiftedTokens
      );

      await contract.deployed();

      return contract;
    },

    attach: (contractAddress: string) => {
      return Contract.attach(contractAddress);
    },
  };
}
