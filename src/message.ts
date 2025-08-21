import type { DatabaseObjectResponse } from '@notionhq/client'
// import open from 'open'
import pMap from 'p-map'

import { notion } from './services/notion'

// eslint-disable-next-line no-process-env
const databaseId = process.env.NOTION_DATABASE_ID!

// const db = await notion.databases.retrieve({
//   database_id: databaseId
// })

const rows: DatabaseObjectResponse[] = []
let cursor: string | undefined

do {
  const current = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Status',
      select: {
        equals: 'needs interview'
      }
    },
    sorts: [
      {
        property: 'X Followers',
        direction: 'descending'
      }
    ],
    start_cursor: cursor
  })

  rows.push(...(current.results as DatabaseObjectResponse[]))

  if (!current.has_more || !current.next_cursor) {
    break
  }

  cursor = current.next_cursor
} while (true)

// console.log(JSON.stringify(db, null, 2))
// console.log(JSON.stringify(rows, null, 2))

const results = (
  await pMap(
    rows,
    async (page) => {
      const email = (page.properties.Email as any).email
      return email
      // const twitterUrl: string = (page.properties.Twitter as any)!.url
      // const twitterUsername = getTwitterUsername(twitterUrl)
      // const xUrl = `https://x.com/${twitterUsername}`
      // console.log(xUrl)
      // await open(xUrl)
    },
    {
      concurrency: 4
    }
  )
).filter(Boolean)

console.log(results.length)
console.log(results.join(', '))

// console.log(JSON.stringify(results, null, 2))
