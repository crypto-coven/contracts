import chalk from "chalk";
import { execSync } from "child_process";

function printServerMissingError() {
  console.log(
    chalk.bold(
      "Can't proceed because local hardhat testnet server is not running."
    )
  );
  console.log(
    `Make sure to run ${chalk.bold.green("yarn start:local")} on a ` +
      `separate terminal before running this command`
  );
  console.log("");
}

function main() {
  try {
    const result = execSync("lsof -PiTCP -sTCP:LISTEN | grep 8545");
    if (result.toString().trim() === "") {
      printServerMissingError();
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (e) {
    printServerMissingError();
    process.exit(1);
  }
}

main();
