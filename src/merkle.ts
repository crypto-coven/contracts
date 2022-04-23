import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

export function generateMerkleTree(addresses: string[]): [
  string,
  {
    [key: string]: string[];
  }
] {
  const hashedAddresses = addresses.map((address) => keccak256(address));
  const tree = new MerkleTree(hashedAddresses, keccak256, { sort: true });

  const root = tree.getHexRoot();
  const treeData: { [key: string]: string[] } = {};

  hashedAddresses.forEach((hashedAddress, index) => {
    const address = addresses[index];
    if (!address) {
      throw new Error(`Missing address for index ${index}`);
    }
    const proof = tree.getHexProof(hashedAddress);
    treeData[address] = proof;
  });
  return [root, treeData];
}
