import type { DatabaseObjectResponse } from '@notionhq/client'
import open from 'open'
import pMap from 'p-map'

import { getTwitterUsername } from './platform-utils'
import { notion } from './services/notion'

// eslint-disable-next-line no-process-env
const databaseId = process.env.NOTION_DATABASE_ID!

console.warn('loading db rows from notion...')

const rows = (
  await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Status',
      select: {
        equals: 'needs interview'
      }
    },
    sorts: [
      {
        timestamp: 'created_time',
        direction: 'descending'
      }
    ]
  })
).results as DatabaseObjectResponse[]

console.warn(`processing ${rows.length} rows...\n`)

const results = (
  await pMap(
    rows,
    async (page) => {
      // const email = (page.properties.Email as any).email
      // return email

      const twitterUrl: string = (page.properties.Twitter as any)!.url
      const twitterUsername = getTwitterUsername(twitterUrl)

      const xUrl = `https://x.com/${twitterUsername}`
      console.log(xUrl)
      await open(xUrl)

      return xUrl

      // await notion.pages.update({
      //   page_id: page.id,
      //   properties: {
      //     Status: {
      //       type: 'select',
      //       select: {
      //         name: 'interview sent'
      //       }
      //     }
      //   }
      // })
    },
    {
      concurrency: 4
    }
  )
).filter(Boolean)

console.log(results.length)
console.log(results.join(', '))
