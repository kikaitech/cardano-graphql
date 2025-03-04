import path from 'path'

import { DocumentNode } from 'graphql'
import util from '@cardano-graphql/util'
import { TestClient } from '@cardano-graphql/util-dev'
import { buildClient } from './util'
import { Genesis } from '@src/graphql_types'
import BigNumber from 'bignumber.js'

const genesis = {
  byron: require('../../../config/network/mainnet/genesis/byron.json'),
  shelley: require('../../../config/network/mainnet/genesis/shelley.json')
} as Genesis

function loadQueryNode (name: string): Promise<DocumentNode> {
  return util.loadQueryNode(path.resolve(__dirname, '..', 'src', 'example_queries', 'ada'), name)
}

describe('ada', () => {
  let client: TestClient
  beforeAll(async () => {
    client = await buildClient('http://localhost:3100', 'http://localhost:8090', 5442, genesis)
  })

  it('returns ada supply information', async () => {
    const result = await client.query({
      query: await loadQueryNode('adaSupply')
    })
    const { ada } = result.data
    const circulatingSupply = new BigNumber(ada.supply.circulating).toNumber()
    const maxSupply = new BigNumber(ada.supply.max).toNumber()
    expect(maxSupply).toEqual(genesis.shelley.maxLovelaceSupply)
    expect(maxSupply).toBeGreaterThanOrEqual(circulatingSupply)
    expect(ada.supply.total).toBeNull()
  })
})
