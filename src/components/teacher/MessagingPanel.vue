<script setup lang="ts">
/**
 * Messages panel (D-72) — the origin's `/teacher/messaging`.
 *
 * The origin shares one `CommunicationMessagesPage` across four role paths, so
 * this panel is the same component the LAEC consoles would use.
 *
 * REPRODUCED
 *  - two panes: conversations on the left, the message thread on the right;
 *  - the conversation list's tabs (`All` / `Direct` / `Groups`) and its search;
 *  - the message-type previews, verbatim: `[Image]`, `[Voice message]`,
 *    `[File] <name>`, `[Lesson Plan] <topic>`;
 *  - `initials()`: strip a leading `Mr./Mrs./Ms./Dr.` then take the first two
 *    initials, which is what the origin renders in each avatar;
 *  - opening a conversation marks it read, which is what zeroes its badge.
 *
 * NOT PORTED, AND IT IS THE BIGGEST DIVERGENCE IN THIS PANEL
 *   The origin is **realtime**: a `socket.io-client` singleton subscribes to
 *   `message:new`, `conversation:created`, `conversation:updated`,
 *   `conversation:deleted`, `message:read` and `notification:new`, and
 *   `applyIncomingMessage` bumps a conversation's unread count for anything that
 *   is not from the current user and not in the open conversation. LAEC's
 *   transport is a request/response `callApi` with no socket and no push, so
 *   this panel polls nothing and receives nothing: a message sent in another
 *   browser appears only after a manual reload. `docs/teacher-portal/api-map.md`
 *   records this rather than implying realtime parity.
 *
 *   Attachments are likewise absent: the origin's upload, forward, delete and
 *   file-download endpoints have no LAEC equivalent, so messaging is text-only.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import type { ChatMessage, Conversation } from '../../types/teacher';

type Filter = 'all' | 'direct' | 'group';

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'direct', label: 'Direct' },
  { id: 'group', label: 'Groups' },
];

const session = useTeacherSession();

const conversations = ref<Conversation[]>([]);
const messages = ref<ChatMessage[]>([]);
const activeId = ref('');
const loading = ref(false);
const loadError = ref('');
const threadLoading = ref(false);
const threadError = ref('');
const filter = ref<Filter>('all');
const search = ref('');
const draft = ref('');
const sending = ref(false);

/* The origin opens a new direct conversation from a user search. */
const newFor = ref('');
const candidates = ref<Array<{ username: string; fullName: string; email: string }>>([]);
const opening = ref(false);

const active = computed(() => conversations.value.find((c) => c.id === activeId.value) ?? null);

const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return conversations.value.filter((c) => {
    if (filter.value !== 'all' && c.kind !== filter.value) return false;
    if (!needle) return true;
    return `${c.name} ${c.lastMessagePreview}`.toLowerCase().includes(needle);
  });
});

const unreadTotal = computed(() => conversations.value.reduce((sum, c) => sum + c.unreadCount, 0));

/** The origin's `initials()`: drop the honorific, then take two initials. */
const initials = (name: string): string =>
  name
    .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/** The origin's per-type preview strings, verbatim. */
const previewOf = (message: ChatMessage): string => {
  if (message.type === 'image') return '[Image]';
  if (message.type === 'voice') return '[Voice message]';
  if (message.type === 'file') return `[File] ${message.body}`;
  if (message.type === 'lesson-plan') return `[Lesson Plan] ${message.body}`;
  return message.body;
};

const formatTime = (value: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const loadConversations = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_TEACHER_CONVERSATIONS', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load conversations.');
    conversations.value = data.conversations;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load conversations.';
  } finally {
    loading.value = false;
  }
};

const loadThread = async (conversationId: string): Promise<void> => {
  threadLoading.value = true;
  threadError.value = '';
  try {
    const data = await callApi('GET_TEACHER_MESSAGES', {
      schoolID: session.schoolID(),
      conversationId,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load messages.');
    messages.value = data.messages;
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Failed to load messages.';
  } finally {
    threadLoading.value = false;
  }
};

/** Opening a conversation clears its badge, exactly as the origin's does. */
const openConversation = async (conversation: Conversation): Promise<void> => {
  activeId.value = conversation.id;
  await loadThread(conversation.id);
  if (conversation.unreadCount > 0) {
    const data = await callApi('MARK_TEACHER_CONVERSATION_READ', {
      schoolID: session.schoolID(),
      conversationId: conversation.id,
    });
    if (data.status === 'success') {
      conversation.unreadCount = 0;
    }
  }
};

const send = async (): Promise<void> => {
  const body = draft.value.trim();
  if (!body || !activeId.value) return;
  sending.value = true;
  threadError.value = '';
  try {
    const data = await callApi('SEND_TEACHER_MESSAGE', {
      schoolID: session.schoolID(),
      conversationId: activeId.value,
      senderUsername: session.username(),
      body,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to send this message.');
    draft.value = '';
    await loadThread(activeId.value);
    await loadConversations();
  } catch (e) {
    threadError.value = e instanceof Error ? e.message : 'Failed to send this message.';
  } finally {
    sending.value = false;
  }
};

const searchNew = async (): Promise<void> => {
  if (newFor.value.trim().length === 0) {
    candidates.value = [];
    return;
  }
  opening.value = true;
  try {
    const data = await callApi('GET_TEACHER_DIRECTORY', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
      search: newFor.value.trim(),
    });
    candidates.value =
      data.status === 'success'
        ? data.staff.map((entry) => ({
            username: entry.username,
            fullName: entry.fullName,
            email: entry.email,
          }))
        : [];
  } catch {
    candidates.value = [];
  } finally {
    opening.value = false;
  }
};

const startConversation = async (username: string): Promise<void> => {
  try {
    const data = await callApi('CREATE_TEACHER_CONVERSATION', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
      username,
    });
    if (data.status !== 'success' || !data.conversation) {
      throw new Error(data.message || 'No users found.');
    }
    newFor.value = '';
    candidates.value = [];
    await loadConversations();
    await openConversation(data.conversation);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'No users found.';
  }
};

onMounted(async () => {
  await loadConversations();
  if (conversations.value.length > 0) await openConversation(conversations.value[0]);
});
</script>

<template>
  <TeacherModuleShell
    title="Messages"
    :description="`${unreadTotal} unread across your conversations.`"
    :loading="loading"
    :error="loadError"
    :empty-count="conversations.length"
    :retryable="true"
    @retry="loadConversations"
  >
    <template #empty>
      <p>No conversations yet.</p>
    </template>

    <template #actions>
      <button
        type="button"
        class="tp-btn"
        :disabled="unreadTotal === 0"
        @click="
          conversations.forEach((c) => {
            if (c.unreadCount > 0)
              callApi('MARK_TEACHER_CONVERSATION_READ', {
                schoolID: session.schoolID(),
                conversationId: c.id,
              });
            c.unreadCount = 0;
          })
        "
      >
        Mark all as read
      </button>
    </template>

    <div class="tp-messaging">
      <aside class="tp-messaging__list">
        <div class="tp-tabs" role="tablist" aria-label="Conversation kind">
          <button
            v-for="entry in FILTERS"
            :key="entry.id"
            type="button"
            role="tab"
            class="tp-tab"
            :class="{ 'tp-tab--on': filter === entry.id }"
            @click="filter = entry.id"
          >
            {{ entry.label }}
          </button>
        </div>
        <input v-model="search" class="tp-input" type="search" placeholder="Search conversations…" />

        <ul class="tp-convlist">
          <li v-for="conversation in filtered" :key="conversation.id">
            <button
              type="button"
              class="tp-conv"
              :class="{ 'tp-conv--on': activeId === conversation.id }"
              @click="openConversation(conversation)"
            >
              <span class="tp-conv__avatar" aria-hidden="true">{{ initials(conversation.name) }}</span>
              <span class="tp-conv__body">
                <span class="tp-conv__name">{{ conversation.name }}</span>
                <span class="tp-conv__preview">{{ conversation.lastMessagePreview || '—' }}</span>
              </span>
              <span v-if="conversation.unreadCount > 0" class="tp-conv__badge">
                {{ conversation.unreadCount > 9 ? '9+' : conversation.unreadCount }}
              </span>
            </button>
          </li>
        </ul>

        <div class="tp-convnew">
          <input
            v-model="newFor"
            class="tp-input"
            type="search"
            placeholder="New direct message..."
            @keyup.enter="searchNew"
          />
          <button type="button" class="tp-btn tp-btn--xs" :disabled="opening" @click="searchNew">
            {{ opening ? 'Searching...' : 'Search' }}
          </button>
          <ul v-if="candidates.length" class="tp-convnew__list">
            <li v-for="entry in candidates" :key="entry.username">
              <button type="button" class="tp-recipient" @click="startConversation(entry.username)">
                {{ entry.fullName }}
              </button>
            </li>
          </ul>
          <p v-else-if="newFor.trim() && !opening" class="tp-inline-note">No users found.</p>
        </div>
      </aside>

      <section class="tp-messaging__thread">
        <template v-if="active">
          <h3 class="tp-card__title">{{ active.name }}</h3>

          <div v-if="threadLoading" class="tp-loading" role="status">
            <span class="tp-loading__ring" aria-hidden="true" />
            <p class="tp-loading__label">Loading messages...</p>
          </div>
          <p v-else-if="threadError" class="tp-form__error" role="alert">{{ threadError }}</p>
          <ul v-else class="tp-msglist">
            <li v-for="message in messages" :key="message.id" class="tp-msg">
              <span class="tp-msg__avatar" aria-hidden="true">{{ initials(message.senderName) }}</span>
              <span class="tp-msg__body">
                <span class="tp-msg__head">
                  <strong>{{ message.senderName }}</strong>
                  <span class="tp-cellsub">{{ formatTime(message.createdAt) }}</span>
                </span>
                <span class="tp-msg__text">{{ previewOf(message) }}</span>
              </span>
            </li>
            <li v-if="messages.length === 0" class="tp-inline-note">No messages yet.</li>
          </ul>

          <form class="tp-composer" @submit.prevent="send">
            <input v-model="draft" class="tp-input" type="text" placeholder="Write a message..." />
            <button type="submit" class="tp-btn tp-btn--primary" :disabled="sending || !draft.trim()">
              {{ sending ? 'Sending...' : 'Send' }}
            </button>
          </form>
        </template>
        <p v-else class="tp-inline-note">Select a conversation to read it.</p>
      </section>
    </div>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-messaging {
  display: grid;
  grid-template-columns: minmax(200px, 300px) 1fr;
  gap: 0.75rem;
  align-items: start;
}

@media (max-width: 860px) {
  .tp-messaging {
    grid-template-columns: 1fr;
  }
}

.tp-messaging__list {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 12px;
  padding: 0.75rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tp-convlist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
  max-height: 340px;
  overflow-y: auto;
}

.tp-conv {
  width: 100%;
  text-align: left;
  font: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tp-conv:hover {
  background: #f7f9fc;
}

.tp-conv--on {
  background: #eaf2fb;
  border-color: #bcd6f0;
}

.tp-conv__avatar,
.tp-msg__avatar {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #eaf2fb;
  color: #16457c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
}

.tp-conv__body {
  flex: 1;
  min-width: 0;
  display: grid;
}

.tp-conv__name {
  font-size: 0.8125rem;
  font-weight: 600;
}

.tp-conv__preview {
  font-size: 0.6875rem;
  color: var(--text-muted, #5b6472);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-conv__badge {
  flex: none;
  font-size: 0.625rem;
  font-weight: 700;
  background: var(--laec-blue, #1c4e80);
  color: #fff;
  border-radius: 999px;
  padding: 0.0625rem 0.375rem;
}

.tp-convnew {
  border-top: 1px solid var(--laec-line, #d7dee8);
  padding-top: 0.5rem;
  display: grid;
  gap: 0.375rem;
}

.tp-convnew__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
  max-height: 140px;
  overflow-y: auto;
}

.tp-recipient {
  width: 100%;
  text-align: left;
  font: inherit;
  font-size: 0.75rem;
  background: transparent;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 6px;
  padding: 0.3125rem 0.4375rem;
  cursor: pointer;
}

.tp-recipient:hover {
  background: #f4f8fd;
}

.tp-messaging__thread {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 12px;
  padding: 0.875rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-height: 260px;
}

.tp-msglist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.625rem;
  overflow-y: auto;
  flex: 1;
}

.tp-msg {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.tp-msg__body {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.tp-msg__head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.tp-msg__text {
  font-size: 0.8125rem;
  background: #f7f9fc;
  border-radius: 8px;
  padding: 0.4375rem 0.625rem;
}

.tp-composer {
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid var(--laec-line, #d7dee8);
  padding-top: 0.625rem;
}

.tp-cellsub {
  display: block;
  font-size: 0.625rem;
  color: var(--text-muted, #5b6472);
}

.tp-form__error {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: #8f2a2a;
}
</style>