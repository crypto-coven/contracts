// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// Hardhat always runs the compile task when running scripts with its command
// line interface
import { ethers } from "hardhat";

const OLD_CONTRACT_ADDRESS = "0xe6dDDa1c3F1cb01Aa5C86a21E8636DEAbfD1F013";

async function main() {
  const contract = (await ethers.getContractFactory("CryptoCoven")).attach(
    OLD_CONTRACT_ADDRESS
  );

  const ownerAddresses = [];
  for (let i = 1; i <= 128; i++) {
    const ownerAddress = await contract.ownerOf(i);
    ownerAddresses.push(ownerAddress);
  }
  console.log(`["${ownerAddresses.join('","')}"]`);

  const total = new Set(ownerAddresses);
  console.log(total.size);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
