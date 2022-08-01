import { FeeEstimation } from "@shardlabs/starknet-hardhat-plugin/dist/src/starknet-types";
import { BigNumber, ethers } from "ethers";
import { starknet } from "hardhat";
import { Account, StarknetContract } from "hardhat/types/runtime";

export const TIMEOUT = 900_000;
export const MINIMUM_LIQUIDITY = 1000;
export const BURN_ADDRESS = 1;

export type CairoUint = {
  low: bigint | Number | BigNumber | BigInt;
  high: bigint | BigInt;
};

export function uint(x: bigint | Number | BigNumber | BigInt): CairoUint {
  return { low: x, high: 0n };
}

export function uintToBigInt(x: any): bigint {
  return x.low;
}

export function feltToAddress(x: bigint | BigInt): string {
  return BigNumber.from(x).toHexString();
}

export function bigintToHex(x: bigint | BigInt): string {
  return BigNumber.from(x).toHexString();
}

export async function deployToken(
  deployerAccount: Account,
  name: string,
  symbol: string
): Promise<StarknetContract> {
  const tokenContractFactory = await starknet.getContractFactory(
    "contracts/token/ERC20.cairo"
  );

  const tokenContract = await tokenContractFactory.deploy(
    {
      name: starknet.shortStringToBigInt(name),
      symbol: starknet.shortStringToBigInt(symbol),
      decimals: 18,
      recipient: deployerAccount.address,
    },
    { salt: "0x42" }
  );
  console.log(name, "deployed at", tokenContract.address);
  return tokenContract;
}

export async function deployFactory(
  feeToAddress: string
): Promise<StarknetContract> {
  const pairContractFactory = await starknet.getContractFactory(
    "contracts/dex/StarkDPair.cairo"
  );
  const declaredPairClass = await pairContractFactory.declare();
  const factory = await starknet.getContractFactory(
    "contracts/dex/StarkDFactory.cairo"
  );
  const factoryContract = await factory.deploy(
    {
      class_hash_pair_contract: declaredPairClass,
      fee_to_setter: feeToAddress,
    },
    { salt: "0x42" }
  );
  console.log("Factory deployed at", factoryContract.address);
  return factoryContract;
}

export async function deployRouter(
  factoryAddress: string
): Promise<StarknetContract> {
  const routerContractFactory = await starknet.getContractFactory(
    "contracts/dex/StarkDRouter.cairo"
  );
  const routerContract = await routerContractFactory.deploy(
    { factory: factoryAddress },
    { salt: "0x42" }
  );
  console.log("Router deployed at", routerContract.address);
  return routerContract;
}

export async function deployPair(
  deployerAccount: Account,
  token0Address: string,
  token1Address: string,
  routerContract: StarknetContract,
  factoryContract: StarknetContract
): Promise<StarknetContract> {
  const pairFactory = await starknet.getContractFactory(
    "contracts/dex/StarkDPair.cairo"
  );

  const executionInfo = await deployerAccount.call(
    routerContract,
    "sort_tokens",
    {
      tokenA: token0Address,
      tokenB: token1Address,
    }
  );

  const pair = await deployerAccount.invoke(factoryContract, "create_pair", {
    tokenA: executionInfo.token0,
    tokenB: executionInfo.token1,
  });
  console.log("Pair deployed at", pair);

  // Does not deploy to network immediately after create_pair call so best to get pair from factory and rebuild contract
  // using result from get_pair. That way, 100% sure that the pair is deployed and ready to use.
  const res0 = await deployerAccount.call(factoryContract, "get_pair", {
    token0: executionInfo.token0,
    token1: executionInfo.token1,
  });
  return pairFactory.getContractAt(res0.pair);
}

export async function estimateFee(
  account: Account,
  contract: StarknetContract,
  functionName: string,
  params: Object
): Promise<FeeEstimation> {
  const estimatedFee = await account.estimateFee(
    contract,
    functionName,
    params
  );
  console.log("Estimated fee to create pair", estimatedFee);
  return estimatedFee;
}

export async function addLiquidity(
  caller: Account,
  routerContract: StarknetContract,
  token0Contract: StarknetContract,
  token1Contract: StarknetContract,
  amount0: Number,
  amount1: Number,
  deadline: Number
) {
  const { decimals: token0Decimals } = await caller.call(
    token0Contract,
    "decimals"
  );

  const { decimals: token1Decimals } = await caller.call(
    token1Contract,
    "decimals"
  );

  const token0Amount = ethers.utils.parseUnits(
    amount0.toString(),
    token0Decimals
  );
  const token1Amount = ethers.utils.parseUnits(
    amount1.toString(),
    token1Decimals
  );

  const txHash = await caller.invoke(routerContract, "add_liquidity", {
    tokenA: token0Contract.address,
    tokenB: token1Contract.address,
    amountADesired: uint(token0Amount),
    amountBDesired: uint(token1Amount),
    amountAMin: uint(0n),
    amountBMin: uint(0n),
    to: caller.address,
    deadline: BigNumber.from(deadline),
  });

  console.log("Liquidity added:", txHash);
  return txHash;
}

export async function mintTokens(
  caller: Account,
  tokenContract: StarknetContract,
  amount: Number,
  recipient: string
) {
  const { decimals: tokenDecimals } = await caller.call(
    tokenContract,
    "decimals"
  );

  const tokenAmount = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

  const txHash = await caller.invoke(tokenContract, "mint", {
    recipient: recipient,
    amount: uint(tokenAmount),
  });

  console.log("Minted", amount, "tokens to", recipient, "\nTx Hash:", txHash);
  return txHash;
}

export async function approve(
  caller: Account,
  tokenContract: StarknetContract,
  amount: Number,
  spender: string
) {
  const { decimals: tokenDecimals } = await caller.call(
    tokenContract,
    "decimals"
  );

  const tokenAmount = ethers.utils.parseUnits(amount.toString(), tokenDecimals);

  const txHash = await caller.invoke(tokenContract, "approve", {
    spender,
    amount: uint(tokenAmount),
  });

  console.log(
    "Approved",
    amount,
    "tokens for",
    spender,
    "to spend",
    "\nTx Hash:",
    txHash
  );
  return txHash;
}

export async function getEventData(txHash: string, eventName: string) {
  const data: String[][] = [];
  const txReceipts = await starknet.getTransactionReceipt(txHash);
  for (const txReceipt of txReceipts.events) {
    if (
      txReceipt.data[0] === bigintToHex(starknet.shortStringToBigInt(eventName))
    ) {
      data.push(txReceipt.data);
    }
  }
  return data;
}
