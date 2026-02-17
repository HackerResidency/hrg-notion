import type { DatabaseObjectResponse } from '@notionhq/client'
import pMap from 'p-map'

import { getGitHubUsername, getTwitterUsername } from './platform-utils'
import { github } from './services/github'
import { notion } from './services/notion'
import { twitter } from './services/twitter'

// eslint-disable-next-line no-process-env
const databaseId = process.env.NOTION_DATABASE_ID!

// const db = await notion.databases.retrieve({
//   database_id: databaseId
// })

const rows = await notion.databases.query({
  database_id: databaseId,
  filter: {
    property: 'X Followers',
    // rty: 'Status',
    number: {
      is_empty: true
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
      const id = page.id
      const githubUrl: string = (page.properties.GitHub as any)!.url
      const twitterUrl: string = (page.properties.Twitter as any)!.url

      const twitterUsername = getTwitterUsername(twitterUrl)
      const githubUsername = getGitHubUsername(githubUrl)

      if (!twitterUsername || !githubUsername) {
        console.warn('error invalid page', id, { githubUrl, twitterUrl })
        return
      }

      try {
        const [githubUser, twitterUser] = await Promise.all([
          github
            .request('GET /users/{username}', {
              username: githubUsername
            })
            .catch(() => undefined),

          twitter
            .getUserByUsername({
              username: twitterUsername
            })
            .catch(() => undefined)
        ])

        // console.log({ github: githubUser.data, twitter: twitterUser })

        const properties: any = {}

        if (twitterUser?.followers_count) {
          properties['X Followers'] = {
            type: 'number',
            number: twitterUser.followers_count
          }
        }

        if (githubUser?.data.followers !== undefined) {
          properties['GH Followers'] = {
            type: 'number',
            number: githubUser.data.followers
          }
        }

        if (!Object.keys(properties).length) {
          return
        }

        await notion.pages.update({
          page_id: id,
          properties
        })

        return {
          id,
          twitterUsername,
          githubUsername
        }
      } catch (err) {
        console.error(
          'error processing page',
          {
            id,
            githubUsername,
            twitterUsername
          },
          err
        )
        return
      }
    },
    {
      concurrency: 16
    }
  )
).filter(Boolean)

console.log(JSON.stringify(results, null, 2))
