import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { CryptoCoven } from "../../typechain";
import { BigNumberish, Signer } from "ethers";

import { WITCHES } from "../../src/contractConstants";

// convert the floating point number to a clean number with two decimal places
export function getExactTotalPrice(price: string, numberOfTokens: number) {
  return Math.round(parseFloat(price) * numberOfTokens * 100) / 100;
}

export async function setPublicSale(
  contract: CryptoCoven,
  isPublicSale: boolean
) {
  return await (await contract.setIsPublicSaleActive(isPublicSale)).wait();
}

export async function setCommunitySale(
  contract: CryptoCoven,
  isPublicSale: boolean
) {
  return await (await contract.setIsCommunitySaleActive(isPublicSale)).wait();
}

export async function mintPublicSale(
  contract: CryptoCoven,
  user: Signer,
  numberOfTokens: number = 1,
  price: string = WITCHES.PUBLIC_SALE_PRICE_ETH
) {
  return await (
    await contract.connect(user).mint(numberOfTokens, {
      value: ethers.utils.parseEther(
        `${getExactTotalPrice(price, numberOfTokens)}`
      ),
    })
  ).wait();
}

export async function mintCommunitySale(
  contract: CryptoCoven,
  user: Signer,
  merkleProof: string[],
  numberOfTokens: number = 1,
  price: string = WITCHES.COMMUNITY_SALE_PRICE_ETH
) {
  return await (
    await contract
      .connect(user)
      .mintCommunitySale(numberOfTokens, merkleProof, {
        value: ethers.utils.parseEther(
          `${getExactTotalPrice(price, numberOfTokens)}`
        ),
      })
  ).wait();
}

export async function claim(
  contract: CryptoCoven,
  user: Signer,
  merkleProof: string[]
) {
  return await (await contract.connect(user).claim(merkleProof)).wait();
}

export async function setCommunityListMerkleRoot(
  contract: CryptoCoven,
  merkleRoot: string
) {
  return await (await contract.setCommunityListMerkleRoot(merkleRoot)).wait();
}

export async function setClaimListMerkleRoot(
  contract: CryptoCoven,
  merkleRoot: string
) {
  return await (await contract.setClaimListMerkleRoot(merkleRoot)).wait();
}

export async function reserveForGifting(
  contract: CryptoCoven,
  numberToReserve: number
) {
  return await (await contract.reserveForGifting(numberToReserve)).wait();
}

export async function giftWitches(contract: CryptoCoven, users: Signer[]) {
  const addresses = await Promise.all(users.map((user) => user.getAddress()));
  return await (await contract.giftWitches(addresses)).wait();
}

export async function getRoyaltyInfo(
  contract: CryptoCoven,
  tokenId: BigNumberish,
  salePrice: string
) {
  return await contract.royaltyInfo(
    tokenId,
    ethers.utils.parseEther(salePrice)
  );
}

export async function withdraw(contract: CryptoCoven) {
  return await (await contract.withdraw()).wait();
}
