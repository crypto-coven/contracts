import { expect } from "chai";
import { ethers } from "hardhat";

import { WITCHES } from "../src/contractConstants";
import { generateMerkleTree } from "../src/merkle";
import {
  getCryptoCoven,
  ContractUtils,
  CryptoCovenDeployArgs,
} from "../src/ContractUtils";
import * as TestUtils from "./utils/CryptoCovenTestUtils";
import { CryptoCoven } from "../typechain";

const { COMMUNITY_SALE_PRICE_ETH, PUBLIC_SALE_PRICE_ETH } = WITCHES;

describe("CryptoCoven", function () {
  let contract: CryptoCoven;
  let CryptoCoven: ContractUtils<CryptoCoven, CryptoCovenDeployArgs>;
  beforeEach(async () => {
    CryptoCoven = await getCryptoCoven();
    contract = await CryptoCoven.deploy({
      maxTokens: 10,
      maxCommunitySaleTokens: 4,
      maxGiftedTokens: 3,
    });
  });

  it("deploys correctly", async function () {
    const [owner] = await ethers.getSigners();

    const ownerBalance = await contract.balanceOf(owner.address);
    expect((await contract.getLastTokenId()).toNumber()).to.equal(ownerBalance);
  });

  describe("nextTokenId", () => {
    it("starts at tokenId 1", async () => {
      await TestUtils.reserveForGifting(contract, 1);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(1);
    });
  });

  describe("mint", () => {
    it("mints correctly when public sale is active", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();

      // Grab current eth balance on the contract
      const currentEthBalance = await contract.provider.getBalance(
        contract.address
      );

      // Execute transaction for given user to mint a witch
      await TestUtils.mintPublicSale(contract, user);

      // Assert the new eth balance in the contract reflects the amount
      // of eth transfered, and that ownership of the token is reflected.
      const newEthBalance = await contract.provider.getBalance(
        contract.address
      );
      const expectedTokenId = "1";
      const userCovenBalance = await contract.balanceOf(user.address);
      expect(
        newEthBalance.eq(
          currentEthBalance.add(ethers.utils.parseEther(PUBLIC_SALE_PRICE_ETH))
        )
      ).to.be.true;
      expect(userCovenBalance.eq(1)).to.be.true;
      expect(await contract.ownerOf(expectedTokenId)).to.equal(user.address);
    });

    it("doesn't mint if public sale is not active", async () => {
      const [_owner, user] = await ethers.getSigners();
      try {
        await TestUtils.mintPublicSale(contract, user);
        expect.fail("Minting public sale should fail if it's not active");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }
    });

    it("doesn't mint if number requested is 0", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      await TestUtils.mintPublicSale(contract, user, 0);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
    });

    it("doesn't mint if number requested would exceed limit per wallet", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();

      try {
        await TestUtils.mintPublicSale(contract, user, 4);
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }

      await TestUtils.mintPublicSale(contract, user, 3);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(3);

      try {
        await TestUtils.mintPublicSale(contract, user, 1);
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      }
    });

    it("doesn't mint if number requested would exceed max allocation of witches for public sale", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user, ...users] = await ethers.getSigners();
      // Mint 6 tokens first
      for (let user of users.slice(0, 6)) {
        await TestUtils.mintPublicSale(contract, user, 1);
      }
      expect((await contract.getLastTokenId()).toNumber()).to.equal(6);

      try {
        await TestUtils.mintPublicSale(contract, user, 2);
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(6);
      }

      await TestUtils.mintPublicSale(contract, user, 1);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(7);

      try {
        await TestUtils.mintPublicSale(contract, user, 1);
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(7);
      }
    });

    it("doesn't mint if eth value sent is insufficient", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      const ts = await contract.getLastTokenId();

      try {
        await TestUtils.mintPublicSale(contract, user, 1, "0.05");
        expect.fail("Minting without sending enough eth should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }

      try {
        await TestUtils.mintPublicSale(contract, user, 2, "0.05");
        expect.fail("Minting without sending enough eth should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }
    });
  });

  describe("mintCommunitySale", () => {
    let merkleTree: { [key: string]: string[] } = {};
    beforeEach(async () => {
      const [_owner, ...users] = await ethers.getSigners();
      const communityListAddresses = users
        .slice(0, 10)
        .map((u: any) => u.address);
      const [root, tree] = generateMerkleTree(communityListAddresses);
      merkleTree = tree;
      await TestUtils.setCommunityListMerkleRoot(contract, root);
    });

    it("mints correctly when community sale is active", async () => {
      // Activate sale
      await TestUtils.setCommunitySale(contract, true);
      const [_owner, user] = await ethers.getSigners();

      // Grab current eth balance on the contract
      const currentEthBalance = await contract.provider.getBalance(
        contract.address
      );

      // Execute transaction for given user to mint a witch
      await TestUtils.mintCommunitySale(
        contract,
        user,
        merkleTree[user.address] ?? []
      );

      // Assert the new eth balance in the contract reflects the amount
      // of eth transfered, and that ownership of the token is reflected.
      const newEthBalance = await contract.provider.getBalance(
        contract.address
      );
      const expectedTokenId = "1";
      const userCovenBalance = await contract.balanceOf(user.address);
      expect(
        newEthBalance.eq(
          currentEthBalance.add(
            ethers.utils.parseEther(COMMUNITY_SALE_PRICE_ETH)
          )
        )
      ).to.be.true;
      expect(userCovenBalance.eq(1)).to.be.true;
      expect(await contract.ownerOf(expectedTokenId)).to.equal(user.address);
    });

    it("doesn't mint if community sale is not active", async () => {
      const [_owner, user] = await ethers.getSigners();
      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? []
        );
        expect.fail(
          "Minting community sale should fail user doesn't belong to community list"
        );
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }
    });

    it("doesn't mint if user doesn't belong to community list", async () => {
      // Activate sale
      await TestUtils.setCommunitySale(contract, true);
      const [_owner, ...users] = await ethers.getSigners();
      const user = users[users.length - 1];
      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          0
        );
        expect.fail("Minting community sale should fail if it's not active");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }
    });

    it("doesn't mint if number requested is 0", async () => {
      // Activate sale
      await TestUtils.setCommunitySale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      await TestUtils.mintCommunitySale(
        contract,
        user,
        merkleTree[user.address] ?? [],
        0
      );
      expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
    });

    it("doesn't mint if number requested would exceed limit per wallet", async () => {
      // Activate sale
      await TestUtils.setCommunitySale(contract, true);
      const [_owner, user] = await ethers.getSigners();

      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          4
        );
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }

      await TestUtils.mintCommunitySale(
        contract,
        user,
        merkleTree[user.address] ?? [],
        3
      );
      expect((await contract.getLastTokenId()).toNumber()).to.equal(3);

      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          1
        );
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      }
    });

    it("doesn't mint if number requested would exceed max allocation of witches for community sale", async () => {
      // Activate sale
      await TestUtils.setCommunitySale(contract, true);
      const [_owner, user, ...users] = await ethers.getSigners();
      // Mint 3 tokens first
      for (let user of users.slice(0, 3)) {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          1
        );
      }
      expect((await contract.getLastTokenId()).toNumber()).to.equal(3);

      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          2
        );
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      }

      await TestUtils.mintCommunitySale(
        contract,
        user,
        merkleTree[user.address] ?? [],
        1
      );
      expect((await contract.getLastTokenId()).toNumber()).to.equal(4);

      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          1
        );
        expect.fail("Minting over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(4);
      }
    });

    it("doesn't mint if eth value sent is insufficient", async () => {
      // Activate sale
      await TestUtils.setCommunitySale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      expect((await contract.getLastTokenId()).toNumber()).to.equal(0);

      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          1,
          "0.04"
        );
        expect.fail("Minting without sending enough eth should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }

      try {
        await TestUtils.mintCommunitySale(
          contract,
          user,
          merkleTree[user.address] ?? [],
          1,
          "0.04"
        );
        expect.fail("Minting without sending enough eth should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }
    });
  });

  it("mints correctly when both sales are active", async () => {
    // Activate sales
    await TestUtils.setPublicSale(contract, true);
    await TestUtils.setCommunitySale(contract, true);
    const [_owner, user1, user2] = await ethers.getSigners();

    // Generate merkle tree
    const communityListAddresses = [user2.address];
    const [root, tree] = generateMerkleTree(communityListAddresses);
    const merkleTree = tree;
    await TestUtils.setCommunityListMerkleRoot(contract, root);

    // Mint a witch for a user on the public sale
    await TestUtils.mintPublicSale(contract, user1);

    // Assert the new eth balance in the contract reflects the amount
    // of eth transfered, and that ownership of the token is reflected.
    let ethBalance = await contract.provider.getBalance(contract.address);
    const user1CovenBalance = await contract.balanceOf(user1.address);
    expect(ethBalance.eq(ethers.utils.parseEther(PUBLIC_SALE_PRICE_ETH))).to.be
      .true;
    expect(user1CovenBalance.eq(1)).to.be.true;
    expect(await contract.ownerOf("1")).to.equal(user1.address);

    // Mint another witch for user on the community list
    // Execute transaction for given user to mint a witch
    await TestUtils.mintCommunitySale(
      contract,
      user2,
      merkleTree[user2.address] ?? []
    );

    // Assert the new eth balance in the contract reflects the amount
    // of eth transfered, and that ownership of the token is reflected.
    ethBalance = await contract.provider.getBalance(contract.address);
    const user2CovenBalance = await contract.balanceOf(user2.address);
    expect(
      ethBalance.eq(
        ethers.utils
          .parseEther(COMMUNITY_SALE_PRICE_ETH)
          .add(ethers.utils.parseEther(PUBLIC_SALE_PRICE_ETH))
      )
    ).to.be.true;
    expect(user2CovenBalance.eq(1)).to.be.true;
    expect(await contract.ownerOf("2")).to.equal(user2.address);
  });

  describe("claim", () => {
    let merkleTree: { [key: string]: string[] } = {};
    beforeEach(async () => {
      const [_owner, ...users] = await ethers.getSigners();
      const giveawayListAddresses = users
        .slice(0, 10)
        .map((u: any) => u.address);
      const [root, tree] = generateMerkleTree(giveawayListAddresses);
      merkleTree = tree;
      await TestUtils.setClaimListMerkleRoot(contract, root);
    });

    it("claims correctly", async () => {
      const [_owner, user] = await ethers.getSigners();

      // Execute transaction for given user to mint a witch
      await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);

      // Assert that ownership of the token is reflected.
      const userCovenBalance = await contract.balanceOf(user.address);
      expect(userCovenBalance.eq(1)).to.be.true;
      expect(await contract.ownerOf("1")).to.equal(user.address);
      expect(await contract.getLastTokenId()).to.equal(1);
    });

    it("claims when at the limit of max allocation", async () => {
      const [_owner, user, ...users] = await ethers.getSigners();
      // Reduce max for gifting to be able to exercise this case
      contract = await CryptoCoven.deploy({
        maxTokens: 10,
        maxCommunitySaleTokens: 4,
        maxGiftedTokens: 1,
      });
      const giveawayListAddresses = [user, ...users]
        .slice(0, 10)
        .map((u) => u.address);
      const [root, tree] = generateMerkleTree(giveawayListAddresses);
      merkleTree = tree;
      await TestUtils.setClaimListMerkleRoot(contract, root);

      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      // Mint max allocation
      for (let user of users.slice(0, 9)) {
        await TestUtils.mintPublicSale(contract, user);
      }
      expect((await contract.getLastTokenId()).toNumber()).to.equal(9);

      await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(10);
      expect(await contract.ownerOf("10")).to.equal(user.address);
    });

    it("doesn't mint if user doesn't belong to claim list", async () => {
      const [_owner, ...users] = await ethers.getSigners();
      const user = users[users.length - 1];
      try {
        await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);
        expect.fail(
          "Claiming should fail if user doesn't belong to claim list"
        );
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }
    });

    it("is able to claim even if max witches per wallet are already minted", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      for (let i = 0; i < 3; i++) {
        await TestUtils.mintPublicSale(contract, user);
      }

      try {
        await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);
        expect((await contract.getLastTokenId()).toNumber()).to.equal(4);
        expect((await contract.balanceOf(user.address)).toNumber()).to.equal(4);
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      }
    });

    it("doesn't claim if it would exceed max allocation for gifting", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      for (let i = 0; i < 3; i++) {
        await TestUtils.giftWitches(contract, [user]);
      }

      try {
        await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);
        expect.fail(
          "Claiming should fail if it would go over max limit for gifting"
        );
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      }
    });

    it("doesn't claim if user has already claimed before", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();
      await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);

      try {
        await TestUtils.claim(contract, user, merkleTree[user.address] ?? []);
        expect.fail("Claiming should fail if user has claimed before");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(1);
      }
    });
  });

  describe("gifting", () => {
    it("can reserve witches correctly", async () => {
      const [owner] = await ethers.getSigners();
      await TestUtils.reserveForGifting(contract, 2);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(2);

      expect(await contract.ownerOf("1")).to.equal(owner.address);
      expect(await contract.ownerOf("2")).to.equal(owner.address);

      await TestUtils.reserveForGifting(contract, 1);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(3);

      expect(await contract.ownerOf("3")).to.equal(owner.address);
    });

    it("doesn't reserve if number requested would exceed max allocation of witches to gift", async () => {
      try {
        await TestUtils.reserveForGifting(contract, 20);
        expect.fail("Reserving over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(0);
      }

      // Reserving under limit should succeed
      await TestUtils.reserveForGifting(contract, 2);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(2);

      try {
        await TestUtils.reserveForGifting(contract, 2);
        expect.fail("Reserving over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(2);
      }
    });

    it("can gift witches correctly", async () => {
      const [_owner, user1, user2] = await ethers.getSigners();

      await TestUtils.giftWitches(contract, [user1, user2]);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(2);
      expect(await contract.ownerOf("1")).to.equal(user1.address);
      expect(await contract.ownerOf("2")).to.equal(user2.address);
    });

    it("minting then gifting works", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user1, user2] = await ethers.getSigners();
      await TestUtils.mintPublicSale(contract, user1);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(1);
      expect(await contract.ownerOf("1")).to.equal(user1.address);

      await TestUtils.giftWitches(contract, [user1, user2]);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      expect(await contract.ownerOf("2")).to.equal(user1.address);
      expect(await contract.ownerOf("3")).to.equal(user2.address);
    });

    it("doesn't gift if number requested would exceed max allocation of witches to figt", async () => {
      // Reserve full supply of gifting
      await TestUtils.reserveForGifting(contract, 3);
      expect((await contract.getLastTokenId()).toNumber()).to.equal(3);

      const [_owner, user1, user2] = await ethers.getSigners();
      try {
        await TestUtils.giftWitches(contract, [user1, user2]);
        expect.fail("Reserving over limit should fail");
      } catch (err: any) {
        if (err.toString().includes("AssertionError")) {
          throw err;
        }
        expect((await contract.getLastTokenId()).toNumber()).to.equal(3);
      }
    });
  });

  describe("royaltyInfo", () => {
    it("provides royalty info as per IERC165 spec", async () => {
      // Activate sale
      await TestUtils.setPublicSale(contract, true);
      const [_owner, user] = await ethers.getSigners();

      // Execute transaction for given user to mint a witch
      await TestUtils.mintPublicSale(contract, user);

      let royaltyInfo;
      const expectedTokenId = "1";

      royaltyInfo = await TestUtils.getRoyaltyInfo(
        contract,
        expectedTokenId,
        PUBLIC_SALE_PRICE_ETH
      );
      // Assert contract is recipient of royalties
      expect(royaltyInfo[0]).to.equal(contract.address);
      // Assert sale price is calculated correctly (5% of sale price)
      expect(
        royaltyInfo[1].eq(
          ethers.utils.parseEther("0.0035") // 5% of 0.07eth
        )
      ).to.be.true;

      // Assert correct royalty info on a hypothetical future sale
      royaltyInfo = await TestUtils.getRoyaltyInfo(
        contract,
        expectedTokenId,
        "10" // eth
      );
      expect(royaltyInfo[0]).to.equal(contract.address);
      expect(
        royaltyInfo[1].eq(
          ethers.utils.parseEther("0.5") // 5% of 10eth
        )
      ).to.be.true;
    });
  });

  describe("withdraw", () => {
    it("owner can withdraw ether correctly", async () => {
      const [owner, ...users] = await ethers.getSigners();
      await contract.setIsPublicSaleActive(true);

      const startingBalance = await owner.getBalance();
      expect(await contract.provider.getBalance(contract.address)).to.equal(
        ethers.BigNumber.from(0)
      );

      // Mint the whole supply
      for (let user of users.slice(0, 7)) {
        await TestUtils.mintPublicSale(contract, user);
      }

      expect(await owner.getBalance()).to.equal(startingBalance);
      expect(await contract.provider.getBalance(contract.address)).to.equal(
        ethers.utils.parseEther("0.49")
      );

      const receipt = await TestUtils.withdraw(contract);

      const endingBalance = await owner.getBalance();
      expect(endingBalance).to.equal(
        startingBalance
          .add(ethers.utils.parseEther("0.49"))
          .sub(receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice))
      );
      expect(await contract.provider.getBalance(contract.address)).to.equal(
        ethers.BigNumber.from(0)
      );
    });
  });

  describe("rollover", () => {
    it("owner can roll over witches from another contract", async () => {
      const [_, ...users] = await ethers.getSigners();
      await contract.setIsCommunitySaleActive(true);

      const originalMinters = [users[0], users[1], users[2]];
      const mintsPerUser = [1, 2, 1];

      // Generate merkle tree
      const communityListAddresses = originalMinters.map(
        (minter) => minter.address
      );
      const [root, tree] = generateMerkleTree(communityListAddresses);
      const merkleTree = tree;
      await TestUtils.setCommunityListMerkleRoot(contract, root);

      // Mint the whole supply
      for (
        let minterCount = 0;
        minterCount < originalMinters.length;
        minterCount++
      ) {
        const currentMinter = originalMinters[minterCount];
        await TestUtils.mintCommunitySale(
          contract,
          currentMinter,
          merkleTree[currentMinter.address],
          mintsPerUser[minterCount]
        );
      }

      expect((await contract.getLastTokenId()).toNumber()).to.equal(4);
      expect(await contract.balanceOf(originalMinters[0].address)).to.equal(
        mintsPerUser[0]
      );
      expect(await contract.balanceOf(originalMinters[1].address)).to.equal(
        mintsPerUser[1]
      );
      expect(await contract.balanceOf(originalMinters[2].address)).to.equal(
        mintsPerUser[2]
      );
      expect(
        (
          await contract.communityMintCounts(originalMinters[0].address)
        ).toNumber()
      ).to.equal(mintsPerUser[0]);
      expect(
        (
          await contract.communityMintCounts(originalMinters[1].address)
        ).toNumber()
      ).to.equal(mintsPerUser[1]);
      expect(
        (
          await contract.communityMintCounts(originalMinters[2].address)
        ).toNumber()
      ).to.equal(mintsPerUser[2]);

      const newContract = await CryptoCoven.deploy({
        maxTokens: 10,
        maxCommunitySaleTokens: 4,
        maxGiftedTokens: 3,
      });

      expect((await newContract.getLastTokenId()).toNumber()).to.equal(0);

      const addresses = [];
      for (
        let minterCount = 0;
        minterCount < originalMinters.length;
        minterCount++
      ) {
        for (
          let mintCount = 0;
          mintCount < mintsPerUser[minterCount];
          mintCount++
        ) {
          addresses.push(originalMinters[minterCount].address);
        }
      }
      newContract.rollOverWitches(addresses);

      expect((await newContract.getLastTokenId()).toNumber()).to.equal(4);
      expect(await newContract.balanceOf(originalMinters[0].address)).to.equal(
        mintsPerUser[0]
      );
      expect(await newContract.balanceOf(originalMinters[1].address)).to.equal(
        mintsPerUser[1]
      );
      expect(await newContract.balanceOf(originalMinters[2].address)).to.equal(
        mintsPerUser[2]
      );

      expect(
        (
          await newContract.communityMintCounts(originalMinters[0].address)
        ).toNumber()
      ).to.equal(mintsPerUser[0]);
      expect(
        (
          await newContract.communityMintCounts(originalMinters[1].address)
        ).toNumber()
      ).to.equal(mintsPerUser[1]);
      expect(
        (
          await newContract.communityMintCounts(originalMinters[2].address)
        ).toNumber()
      ).to.equal(mintsPerUser[2]);
    });
  });
});
