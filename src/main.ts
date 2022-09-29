import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/rest'

async function run(): Promise<void> {
  try {
    const token = core.getInput('token', {required: true})

    const {owner, repo} = github.context.repo

    const octokit = new Octokit({
      auth: token,
      log: {
        debug: core.debug,
        info: core.info,
        warn: core.warning,
        error: core.error
      }
    })

    const findComment = async (body: string): Promise<number | null> => {
      const comments = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: github.context.issue.number
      })

      for (let i = 0; i < comments.data.length; i++) {
        const comment = comments.data[i]

        if (!comment.user || comment.user.login != 'github-actions[bot]') {
          continue
        }

        if (!comment.body || !comment.body.includes(body)) {
          continue
        }

        return comment.id
      }

      return null
    }

    const updateComment = async (
      comment_id: number,
      body: string
    ): Promise<void> => {
      core.info(`Updating comment ${comment_id}`)

      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: comment_id,
        body
      })
    }

    const createComment = async (body: string): Promise<void> => {
      core.info(`Posting new comment`)

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: github.context.issue.number,
        body
      })
    }

    const title = 'Pull request artifacts'
    let body = `## 🤖 ${title}
Artifacts can be downloaded from ${`https://github.com/${owner}/${repo}/actions/runs/${github.context.runId}`}
`

    const comment_id = await findComment(title)
    if (comment_id) {
      await updateComment(comment_id, body)
    } else {
      await createComment(body)
    }
  } catch (error: unknown) {
    console.error(error)
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

run()
