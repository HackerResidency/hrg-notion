import type { DatabaseObjectResponse } from '@notionhq/client'
import pMap from 'p-map'

import { getGitHubUsername } from './platform-utils'
import { github } from './services/github'
import { notion } from './services/notion'

// eslint-disable-next-line no-process-env
const databaseId = process.env.NOTION_DATABASE_ID!

const rows: DatabaseObjectResponse[] = []
let cursor: string | undefined

console.warn('loading db rows from notion...')

do {
  const current = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'GH Followers',
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

console.warn(`processing ${rows.length} rows...\n`)

const results = (
  await pMap(
    rows,
    async (page) => {
      try {
        // const email = (page.properties.Email as any).email
        // return email
        const githubUrl: string = (page.properties.GitHub as any)!.url
        const githubUsername = getGitHubUsername(githubUrl)
        let numFollowers = 0

        if (githubUsername) {
          const user = await github.rest.users.getByUsername({
            username: githubUsername
          })

          if (user) {
            numFollowers = user.data.followers
          } else {
            console.warn('error invalid GitHub user', {
              githubUsername,
              githubUrl
            })
          }
        } else {
          console.warn('error invalid GitHub username', { githubUrl })
        }

        console.log(githubUrl, '=>', numFollowers)

        await notion.pages.update({
          page_id: page.id,
          properties: {
            'GH Followers': {
              type: 'number',
              number: numFollowers
            }
          }
        })

        return { id: page.id, githubUrl, numFollowers }
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
