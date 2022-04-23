const dotenv = require("dotenv");

dotenv.config();

import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatUserConfig, task } from "hardhat/config";
import { TASK_CONSOLE, TASK_RUN } from "hardhat/builtin-tasks/task-names";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import { OPEN_SEA_PROXY_REGISTRY_ADDRESS } from "./src/Env";
import {
  WITCHES,
  WITCHES_CONTRACT_NAME,
  CONTRACT_NAMES,
} from "./src/contractConstants";

function getCompiledLocation(contractName: string): string {
  return `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
}

function getABITargetLocation(contractName: string): string {
  // normally points to the client so that it has the correct abis
  return `./data/${contractName}-abi.json`;
}

function getContractNameFromArg(contract: string): string {
  let contractName;
  switch (contract) {
    case "witches":
      contractName = WITCHES_CONTRACT_NAME;
      break;
    default:
      throw new Error(
        "Invalid value received for 'contract' positional argument."
      );
  }

  return contractName;
}

function getLocalDevAccountConfig() {
  if (process.env.MNEMONIC) {
    return {
      mnemonic: process.env.MNEMONIC,
    };
  }
  return process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [];
}

function connectLocalDevWallet(hre: HardhatRuntimeEnvironment) {
  // Connect local dev account to network if it's available
  if (process.env.MNEMONIC) {
    hre.ethers.Wallet.fromMnemonic(process.env.MNEMONIC).connect(
      hre.ethers.provider
    );
  } else if (process.env.PRIVATE_KEY) {
    new hre.ethers.Wallet(process.env.PRIVATE_KEY).connect(hre.ethers.provider);
  }
}

function printConsoleSummary() {
  console.log("");
  console.log("To access the contract from the console:");
  console.log("");
  console.log(
    `${chalk.bold.whiteBright(
      'contract = await (await ethers.getContractFactory("CryptoCoven")).attach("'
    )}${chalk.bold.green("<ADDRESS_HERE>")}${chalk.bold.gray('");')}`
  );
  console.log("");
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

task("accounts", "Prints the list of accounts", async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

task(
  "get-rollover-addresses",
  "Grabs addresses to issue new tokens in rollover mint"
).setAction(async (_args, hre) => {
  await hre.run(TASK_RUN, {
    script: "scripts/get-rollover-addresses.ts",
    network: hre.network,
  });
});

task("coven-compile", "Copies compiled artifacts to the client directory")
  .addOptionalPositionalParam(
    "contract",
    "Contract to compile. Possible values: witches, items."
  )
  .addOptionalParam(
    "contractName",
    "The exact name of the contract to compile. Possible values: CryptoCoven."
  )
  .setAction(async (args, hre) => {
    if (!args.noCompile) {
      await hre.run("compile");
    }

    const contractNames =
      typeof args.contractName === "string"
        ? [args.contractName]
        : typeof args.contract === "string"
        ? [getContractNameFromArg(args.contract)]
        : CONTRACT_NAMES;

    for (const contractName of contractNames) {
      try {
        console.log("");
        if (!args.noCompile) {
          console.log(
            "Compiled contract " + chalk.bold.greenBright(contractName)
          );
          console.log("");
        }
        const compiledLocation = getCompiledLocation(contractName);
        const targetLocation = getABITargetLocation(contractName);
        const compiled = readFileSync(compiledLocation);
        const compiledJSON = JSON.parse(compiled.toString());
        const abi = compiledJSON.abi;
        if (!abi) {
          console.log(
            chalk.red(
              `No ABI found in compiled contract at ${chalk.bold.redBright(
                compiledLocation
              )}`
            )
          );
          process.exit(1);
        }
        if (!existsSync("./data")) {
          mkdirSync("./data");
        }
        writeFileSync(targetLocation, JSON.stringify(abi, null, 2));
        console.log(
          "Successfully copied contract ABI to " +
            chalk.bold.greenBright(`data/${contractName}-abi.json`)
        );
        console.log("");
      } catch (e) {
        console.log(chalk.red("Error copying artifacts: " + e));
      }
    }
  });

task(
  "coven-deploy",
  "Deploys contract and starts console with coven-specific configs"
)
  .addPositionalParam(
    "contract",
    "Contract to deploy. Possible values: witches, items."
  )
  .setAction(async (args, hre) => {
    if (hre.network.name === "localhost") {
      connectLocalDevWallet(hre);
    }

    if (!args.contract) {
      throw new Error(
        "Missing value for required positional argument: 'contract'."
      );
    }

    const contractName = getContractNameFromArg(args.contract);

    const signer = hre.ethers.provider.getSigner();
    const address = await signer.getAddress();
    const contractMetadataLocation = `./data/${contractName}-metadata-${hre.network.name}.json`;
    const contractMetadataLatestDeployedLocation = `./data/${contractName}-latest-deployed.txt`;

    console.log("");
    console.log(
      `Deploying contract ` + chalk.bold.greenBright(contractName) + "..."
    );
    console.log(`NETWORK: ${hre.network.name}`);
    console.log(`SIGNER: ${address}`);
    console.log("");

    try {
      const { getCryptoCoven } = require("./src/ContractUtils");
      const CryptoCoven = await getCryptoCoven();
      const contract = await CryptoCoven.deploy({
        maxTokens: WITCHES.MAX_WITCHES,
        maxCommunitySaleTokens: WITCHES.MAX_COMMUNITY_SALE_WITCHES,
        maxGiftedTokens: WITCHES.MAX_GIFTED_WITCHES,
      });

      writeFileSync(
        contractMetadataLocation,
        JSON.stringify(
          {
            network: hre.network.name,
            address: contract.address,
          },
          null,
          2
        )
      );
      writeFileSync(contractMetadataLatestDeployedLocation, contract.address);

      console.log(
        "Contract deployed to address: ",
        chalk.bold.greenBright(contract.address)
      );
    } catch (e) {
      console.log(chalk.red("Error deploying contract: " + e));
    }

    await hre.run("coven-compile", {
      noCompile: true,
      contractName: contractName,
    });

    printConsoleSummary();
    await hre.run(TASK_CONSOLE, { network: hre.network, noCompile: true });
  });

task(
  "coven-verify",
  "Deploys contract and starts console with coven-specific configs"
)
  .addPositionalParam(
    "contract",
    "Contract to verify. Possible values: witches, items."
  )
  .setAction(async (args, hre) => {
    if (hre.network.name === "localhost") {
      console.log(
        chalk.red(
          "We don't need to verify on etherscan when running on localhost."
        )
      );
      return;
    }

    const contractName = getContractNameFromArg(args.contract);

    console.log(
      "Verifying contract ",
      chalk.bold.greenBright(contractName) + " on etherscan..."
    );
    let address;
    try {
      const contractMetadata = readFileSync(
        `./data/contract-metadata-${hre.network.name}.json`
      );
      address = JSON.parse(contractMetadata.toString()).address;
      if (address == null) {
        console.log(
          chalk.red(
            `Could not find contract address for network ${hre.network.name}.`
          )
        );
        console.log(
          `Make sure you've run ` +
            chalk.greenBright(
              `yarn deploy:${hre.network.name} ${args.contract}`
            ) +
            ` first.`
        );
        process.exit(1);
      }
    } catch (e) {
      console.log(
        chalk.red(
          `Could not find contract address for network ${hre.network.name}.`
        )
      );
      console.log(
        `Make sure you've run ` +
          chalk.greenBright(
            `yarn deploy:${hre.network.name} ${args.contract}`
          ) +
          ` first.`
      );
      process.exit(1);
    }

    let constructorArguments;
    switch (args.contract) {
      case "witches":
        constructorArguments = [
          OPEN_SEA_PROXY_REGISTRY_ADDRESS,
          WITCHES.MAX_WITCHES,
          WITCHES.MAX_COMMUNITY_SALE_WITCHES,
          WITCHES.MAX_GIFTED_WITCHES,
        ];
        break;
      case "items":
        constructorArguments = [OPEN_SEA_PROXY_REGISTRY_ADDRESS];
        break;
      default:
        throw new Error(
          "Invalid value received for 'contract' positional argument."
        );
    }

    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
    });
  });

task("coven-console", "Starts console with coven-specific configs").setAction(
  async (_args, hre) => {
    if (hre.network.name === "localhost") {
      connectLocalDevWallet(hre);
    }
    printConsoleSummary();
    await hre.run(TASK_CONSOLE, { network: hre.network, noCompile: true });
  }
);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
      },
    },
  },
  defaultNetwork: "ropsten",
  networks: {
    hardhat: {
      accounts: {
        count: process.env.NUM_GENERATED_ACCOUNTS
          ? parseInt(process.env.NUM_GENERATED_ACCOUNTS, 10)
          : 20,
      },
      chainId: 31337,
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts: getLocalDevAccountConfig(),
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts: getLocalDevAccountConfig(),
    },
    mainnet: {
      url: process.env.MAINNET_URL || "",
      accounts: getLocalDevAccountConfig(),
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    gasPriceApi:
      "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
