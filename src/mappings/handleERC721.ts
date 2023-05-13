import { BigNumber } from "ethers";
import { Collection, ContractType, Nft} from "../types";
import { TransferLog } from "../types/abi-interfaces/Erc721";
import {Erc721__factory} from "../types/contracts/factories/Erc721__factory";
import assert from "assert";

export async function handleERC721(
    event: TransferLog,
): Promise<void> {

  const instance = Erc721__factory.connect(event.address, api);
  let totalSupply = BigInt(0)
  let isERC721 = false

  try {
    isERC721 = await instance.supportsInterface('0x80ac58cd');

    if (!isERC721){
      return
    }
    logger.info(`isERC721 ${isERC721}`)
    logger.info(`address: ${event.address}`)
    logger.info(`tx: ${event.transactionHash}`)
  } catch (e) {
    return;
  }

  assert(event.args, 'No event args on erc721')

  let isERC721Metadata = false
  let isERC721Enumerable = false

  try {
    // interface defined: https://eips.ethereum.org/EIPS/eip-721
    [isERC721Enumerable, isERC721Metadata] = await Promise.all([
      instance.supportsInterface('0x780e9d63'),
      instance.supportsInterface('0x5b5e139f')
    ])
  } catch {

  }

  // TODO Refactor
  let collection = await Collection.get(event.address)

  if (!collection) {
    let name: string | undefined
    let symbol: string | undefined

    logger.info(`isERC721Metadata ${isERC721Metadata}`)

    if (isERC721Metadata) {
      [name, symbol] = await Promise.all([
        instance.name(),
        instance.symbol(),
      ])
    }

    logger.info(`isEnumerable ${isERC721Enumerable}`)
    if (isERC721Enumerable) {
      totalSupply = (await instance.totalSupply()).toBigInt()
      logger.info(`Enumerable, total supply ${totalSupply}`)
    }

    collection = Collection.create({
      id: event.address,
      network: chainId,
      contract_address: event.address,
      created_block: BigInt(event.blockNumber),
      created_timestamp: event.block.timestamp,
      creator_address: event.transaction.from,
      total_supply: totalSupply,
      name,
      symbol
    })
    await collection.save()
  }

  const nftId = `${collection.id}-${event.args.tokenId}`
  logger.info(`about to get NFT ${nftId}`)
  let nft = await Nft.get(nftId)

  if (!nft) {
    logger.info(`nft created at ${event.blockNumber}`)
    let metadataUri
    try {
      metadataUri = isERC721Metadata ? (await instance.tokenURI(event.args.tokenId)) : undefined
    } catch (e) {
      logger.warn(`metadata URI not available`)
    }

    logger.info(`event: ${event.args.tokenId.toString()}`)
    logger.info(`event: ${event.args.to}`)
    logger.info(`event: ${event.args.from}`)

    // const metadataJson = metadataUri ? await decodeMetadata(metadataUri) : undefined

    nft = Nft.create({
      id: nftId,
      tokenId: event.args.tokenId.toString(),
      amount: BigInt(1),
      collectionId: collection.id,
      minted_block: BigInt(event.blockNumber),
      minted_timestamp: event.block.timestamp,
      minter_address: event.transaction.from,
      current_owner: event.args.to,
      contract_type: ContractType.ERC721,
      metadata_uri: metadataUri,
    } as Nft)

    logger.info(`new nft, collection id: ${collection.id}`)
    logger.info(`total supply: ${collection.total_supply}`)
    try {
      collection.total_supply = isERC721Enumerable
        ?(await instance.totalSupply()).toBigInt()
        : collection.total_supply = BigNumber.from(collection.total_supply).add(1).toBigInt()
    } catch (e) {
      collection.total_supply = BigNumber.from(collection.total_supply).add(1).toBigInt()
    }

    await Promise.all([
      collection.save(),
      nft.save()
    ])
  }
}
