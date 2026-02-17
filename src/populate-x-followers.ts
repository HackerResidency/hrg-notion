import type { DatabaseObjectResponse } from '@notionhq/client'
// import open from 'open'
import pMap from 'p-map'

import { getTwitterUsername } from './platform-utils'
import { notion } from './services/notion'
import { twitter } from './services/twitter'

// eslint-disable-next-line no-process-env
const databaseId = process.env.NOTION_DATABASE_ID!

const rows: DatabaseObjectResponse[] = []
let cursor: string | undefined

console.warn('loading database from notion...')

do {
  const current = await notion.databases.query({
    database_id: databaseId,
    filter: {
      // property: 'Status',
      // select: { equals: 'needs interview' }
      property: 'X Followers',
      number: {
        is_empty: true
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
// console.log(rows.length, 'rows', JSON.stringify(rows, null, 2))
console.warn(`processing ${rows.length} rows...\n`)
// rows = rows.slice(0, 10) // useful for testing

const results = (
  await pMap(
    rows,
    async (page) => {
      try {
        // const email = (page.properties.Email as any).email
        // return email
        const twitterUrl: string = (page.properties.Twitter as any)!.url
        const twitterUsername = getTwitterUsername(twitterUrl)
        let numFollowers = 0

        if (twitterUsername) {
          const user = await twitter.getUserByUsername({
            username: twitterUsername
          })

          if (user) {
            numFollowers = user.followers_count
          } else {
            console.warn('error invalid X user', {
              twitterUsername,
              twitterUrl
            })
          }
        } else {
          console.warn('error invalid X username', { twitterUrl })
        }

        console.log(twitterUrl, '=>', numFollowers)

        await notion.pages.update({
          page_id: page.id,
          properties: {
            'X Followers': {
              type: 'number',
              number: numFollowers
            }
          }
        })

        // const xUrl = `https://x.com/${twitterUsername}`
        // console.log(xUrl)
        // await open(xUrl)

        return { id: page.id, twitterUrl, numFollowers }
      } catch (err: any) {
        console.error('error processing page', page.id, err.message)
        return
      }
    },
    {
      concurrency: 4
    }
  )
).filter(Boolean)

console.log(JSON.stringify(results, null, 2))
