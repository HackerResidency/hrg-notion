import type { DatabaseObjectResponse } from '@notionhq/client'
import pMap from 'p-map'

import { notion } from './services/notion'

// eslint-disable-next-line no-process-env
const databaseId = process.env.NOTION_DATABASE_ID!

const rows = await notion.databases.query({
  database_id: databaseId,
  filter: {
    property: 'Status',
    select: {
      equals: 'INVITED'
    }
  },
  sorts: [
    {
      timestamp: 'created_time',
      direction: 'descending'
    }
  ]
})

// console.log(JSON.stringify(db, null, 2))
// console.log(JSON.stringify(rows, null, 2))

const results = (
  await pMap(
    rows.results as DatabaseObjectResponse[],
    async (page) => {
      const email = (page.properties.Email as any).email
      return email
    },
    {
      concurrency: 16
    }
  )
).filter(Boolean)

console.log(results.length)
console.log(results.join(', '))
