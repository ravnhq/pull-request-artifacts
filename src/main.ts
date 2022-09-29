import * as fs from 'fs'
import path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/rest'
import glob from 'glob'

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

    const findWorkflowRunArtifacts = async () => {
      const {data: repoArtifacts} =
        await octokit.rest.actions.listWorkflowRunArtifacts({
          owner,
          repo,
          run_id: github.context.runId
        })

      core.info(JSON.stringify(repoArtifacts, null, 2))
      core.info(github.context.workflow)
      core.info(github.context.runId.toString())

      const runArtifacts = repoArtifacts.artifacts.filter(artifact => {
        core.info(
          `Github Context RunID: ${
            github.context.runId
          }\nArtifact RunID      :${artifact.workflow_run?.id}\nEqual: ${
            github.context.runId === artifact.workflow_run?.id
          }`
        )
        return [artifact.workflow_run?.id].includes(github.context.runId)
      })
      core.info(JSON.stringify(runArtifacts))

      return runArtifacts
    }

    const title = 'Pull request artifacts'
    let body = `## 🤖 ${title}
| file |
| ---- |
`

    const artifactList = await findWorkflowRunArtifacts()

    for (let artifact of artifactList) {
      // for (let file of files) {
      //   const {base} = path.parse(file)
      //   const content = fs.readFileSync(file)

      //   const target_name = `pr${github.context.issue.number}-${base}`
      // const target_link = await uploadFile(target_name, content)
      core.info(JSON.stringify(artifact, null, 2))

      body += `| [\`${artifact.name}\`](${'target_link'}) |`
      body += '\n'
      // }
    }

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
