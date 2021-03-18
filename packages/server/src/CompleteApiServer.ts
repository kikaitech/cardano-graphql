import { Config } from './config'
import { Server } from './Server'
import {
  buildSchema as buildCardanoDbHasuraSchema,
  CardanoNodeClient,
  createCardanoCli,
  DataSyncController,
  Db,
  Genesis,
  HasuraClient,
  HostDoesNotExist
} from '@cardano-graphql/api-cardano-db-hasura'
import { GraphQLSchema } from 'graphql'
import { dummyLogger, Logger } from 'ts-log'

export * from './config'

export async function CompleteApiServer (
  config: Config,
  logger: Logger = dummyLogger
): Promise<Server> {
  const schemas: GraphQLSchema[] = []
  let genesis: Genesis
  let cardanoNodeClient: CardanoNodeClient
  if (config.genesis.byronPath !== undefined || config.genesis.shelleyPath !== undefined) {
    genesis = {
      ...config.genesis.byronPath !== undefined ? { byron: require(config.genesis.byronPath) } : {},
      ...config.genesis.shelleyPath !== undefined ? { shelley: require(config.genesis.shelleyPath) } : {}
    }
  }
  const lastConfiguredMajorVersion = require(config.cardanoNodeConfigPath)['LastKnownBlockVersion-Major']

  if (config.cardanoCliPath !== undefined) {
    cardanoNodeClient = new CardanoNodeClient(
      createCardanoCli(config.cardanoCliPath, genesis.shelley, config.jqPath),
      lastConfiguredMajorVersion,
      logger
    )
  }
  const hasuraClient = new HasuraClient(
    config.hasuraCliPath,
    config.hasuraUri,
    config.pollingInterval.adaSupply,
    lastConfiguredMajorVersion,
    logger
  )
  const db = new Db(config.db, logger)
  const dataSyncController = new DataSyncController(
    hasuraClient,
    db,
    config.pollingInterval.metadataSync,
    logger,
    config.metadataServerUri
  )
  await db.init({
    onDbSetup: () => Promise.all([
      hasuraClient.initialize()
        .then(() => dataSyncController.initialize())
        .catch((error) => {
          if (error instanceof HostDoesNotExist) {
            logger.error(error.message)
            process.exit(1)
          }
        }),
      cardanoNodeClient.initialize()
    ])
  })
  schemas.push(await buildCardanoDbHasuraSchema(hasuraClient, genesis, cardanoNodeClient))
  return new Server(schemas, config, logger)
}
