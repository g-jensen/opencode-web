import { createResource, For, Show } from "solid-js"
import { A, useParams } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import type { Session } from "@opencode-ai/sdk/v2/client"

type SessionNode = {
  session: Session
  children: SessionNode[]
}

export function SubagentCalls(props: { sessionID: string | undefined }) {
  const sdk = useSDK()
  const params = useParams()

  const findRoot = async (sessionID: string): Promise<Session> => {
    const res = await sdk.client.session.get({ sessionID })
    const session = res.data
    if (!session) throw new Error("Session not found")
    if (!session.parentID) return session
    return findRoot(session.parentID)
  }

  const fetchTree = async (sessionID: string): Promise<SessionNode[]> => {
    const res = await sdk.client.session.children({ sessionID })
    const sessions = res.data ?? []

    const nodes = await Promise.all(
      sessions.map(
        async (session): Promise<SessionNode> => ({
          session,
          children: await fetchTree(session.id),
        }),
      ),
    )

    return nodes
  }

  const [tree] = createResource(
    () => props.sessionID,
    async (sessionID) => {
      if (!sessionID) return undefined
      const root = await findRoot(sessionID)
      const children = await fetchTree(root.id)
      return { root, children }
    },
  )

  return (
    <Show when={!tree.loading} fallback={<div class="text-text-dimmed-base text-sm p-2">Loading...</div>}>
      <Show when={tree()} fallback={<div class="text-text-dimmed-base text-sm p-2">No session</div>}>
        {(data) => (
          <div class="font-mono text-sm">
            <TreeNode
              node={{ session: data().root, children: data().children }}
              depth={0}
              currentID={props.sessionID}
              dir={params.dir ?? ""}
            />
          </div>
        )}
      </Show>
    </Show>
  )
}

function TreeNode(props: { node: SessionNode; depth: number; currentID: string | undefined; dir: string }) {
  const indent = () => props.depth * 16
  const hasChildren = () => props.node.children.length > 0
  const isCurrent = () => props.node.session.id === props.currentID
  const href = () => `/${props.dir}/session/${props.node.session.id}`

  return (
    <div>
      <A
        href={href()}
        class="flex items-center gap-2 py-1 px-2 rounded no-underline cursor-pointer"
        classList={{
          "hover:bg-surface-base-hover": !isCurrent(),
          "bg-surface-base-hover": isCurrent()
        }}
        style={{ "padding-left": `${indent() + 8}px` }}
      >
        <span
          class="select-none"
          classList={{ "text-text-on-brand-base": isCurrent(), "text-text-weak": !isCurrent() }}
        >
          {hasChildren() ? "\u25BC" : "\u2500"}
        </span>
        <span
          class="truncate"
          classList={{ "font-medium text-text-on-brand-base": isCurrent(), "text-text-base": !isCurrent() }}
          title={props.node.session.title}
        >
          {props.node.session.title || props.node.session.id.slice(0, 8)}
        </span>
      </A>
      <Show when={hasChildren()}>
        <For each={props.node.children}>
          {(child) => <TreeNode node={child} depth={props.depth + 1} currentID={props.currentID} dir={props.dir} />}
        </For>
      </Show>
    </div>
  )
}
