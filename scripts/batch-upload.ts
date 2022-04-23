import "@nomiclabs/hardhat-ethers";
import fs from "fs";
import path from "path";
import pinataSDK from "@pinata/sdk";

import { WITCHES } from "../src/contractConstants";
// import { generateOpenseaMetadataPlaceholder } from "../../server/src/metadataGenerator";
import { getCryptoCoven } from "../src/ContractUtils";
import { WITCHES_CONTRACT_ADDRESS } from "../src/Env";

const DATA_DIR = path.resolve(
  `${process.env.PWD}/../witches-curated/witch-data`
);
const UPLOAD_DIR = path.resolve(
  `${process.env.PWD}/../server/src/data/revealed-witches`
);

(async () => {
  const pinataAPIKey = process.env.PINATA_API_KEY;
  const pinataAPISecret = process.env.PINATA_API_SECRET;
  if (!pinataAPIKey || !pinataAPISecret) {
    throw new Error(
      "Please set PINATA_API_KEY and PINATA_API_SECRET environment variable."
    );
  }
  const pinata = pinataSDK(pinataAPIKey, pinataAPISecret);

  const CryptoCoven = await getCryptoCoven();
  if (!WITCHES_CONTRACT_ADDRESS) {
    throw new Error(
      "Target network not set. Please set the WITCHES_CONTRACT_ADDRESS environment variable."
    );
  }
  const cryptoCoven = CryptoCoven.attach(WITCHES_CONTRACT_ADDRESS);

  // Query the contract for the total number of witches minted so far.
  const totalWitchesMinted = (await cryptoCoven.getLastTokenId()).toNumber();

  console.log(`Clearing upload directory ${UPLOAD_DIR}...`);
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOAD_DIR);

  console.log(
    `${totalWitchesMinted} total witches minted so far. Copying minted witch metadata from data directory to upload directory...`
  );

  for (let i = 1; i <= totalWitchesMinted; ++i) {
    const src = `${DATA_DIR}/${i}.json`;
    const dest = `${UPLOAD_DIR}/${i}.json`;
    fs.copyFileSync(src, dest);
  }

  console.log(
    `Creating ${
      WITCHES.MAX_WITCHES_MINTED - totalWitchesMinted
    } metadata placeholder entries in upload directory...`
  );

  for (let i = totalWitchesMinted + 1; i <= WITCHES.MAX_WITCHES_MINTED; ++i) {
    // relies on internal infrastructure... swapping to a placeholder for the placeholder
    // const metadata = generateOpenseaMetadataPlaceholder();
    const metadata = {};
    fs.writeFileSync(`${UPLOAD_DIR}/${i}.json`, JSON.stringify(metadata));
  }

  fs.readdir(UPLOAD_DIR, (_, files) => {
    if (files.length === 0) {
      throw new Error("No JSON files found to upload");
    } else {
      console.log(`Counted ${files.length} files to upload...`);
    }
  });

  // Upload witch-data to ipfs
  console.log("Uploading new metadata directory to Pinata...");
  try {
    const pinnedObj = await pinata.pinFromFS(UPLOAD_DIR);
    console.log(`New IPFS cid for metadata directory: ${pinnedObj.IpfsHash}`);

    // Update the contract's CID for the new metadata directory.
    console.log("Updating contract with new base URI for the metadata...");
    await cryptoCoven.setBaseURI(`ipfs://${pinnedObj.IpfsHash}`);
    console.log("Done!");
  } catch (err) {
    console.log(err);
  }
})();
