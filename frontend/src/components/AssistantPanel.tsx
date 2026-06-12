import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Kbd,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSend, IconSparkles } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import { streamAssistant, type ChatTurn } from '../api/assistant';
import { errorMessage } from '../api/client';
import { JpMarkdown } from './JpMarkdown';

const SUGGESTIONS = [
  'What is my best-margin product?',
  'How much profit have I made overall?',
  'Which products are low on stock?',
];

interface AssistantPanelProps {
  opened: boolean;
  onClose: () => void;
}

export function AssistantPanel({ opened, onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;

    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    setInput('');
    setFollowups([]);
    setStreaming(true);

    const setAnswer = (content: string) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content };
        return copy;
      });

    try {
      await streamAssistant(message, history, {
        onText: setAnswer,
        onFollowups: setFollowups,
      });
    } catch (err) {
      // streamAssistant throws an Error whose message is the (already clean)
      // server detail; fall back to the generic helper for anything else.
      setAnswer(err instanceof Error ? err.message : errorMessage(err));
    } finally {
      setStreaming(false);
    }
  };

  const empty = messages.length === 0;
  const lastIsEmptyAssistant =
    streaming && messages.at(-1)?.role === 'assistant' && !messages.at(-1)?.content;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      radius="md"
      yOffset="8vh"
      overlayProps={{ backgroundOpacity: 0.5, blur: 3 }}
      transitionProps={{ transition: 'pop', duration: 150 }}
      padding="lg"
      title={
        <Group gap="xs">
          <IconSparkles size={18} color="var(--brand-forest)" />
          <Text ff="heading" fw={500} fz="lg">
            JP
          </Text>
          <Badge size="xs" variant="light" color="forest">
            AI Ops Assistant
          </Badge>
        </Group>
      }
    >
      <Stack gap="md" h="min(64vh, 560px)">
        <ScrollArea style={{ flex: 1 }} viewportRef={viewport} type="auto">
          {empty ? (
            <Stack gap="sm" pt="xs">
              <Text size="sm" c="dimmed">
                Ask about your inventory, stock and profitability — JP reads your live
                data. Try one of these:
              </Text>
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="default"
                  size="xs"
                  radius="xl"
                  justify="flex-start"
                  onClick={() => send(s)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {s}
                </Button>
              ))}
            </Stack>
          ) : (
            <Stack gap="sm" pr="sm">
              {messages.map((m, i) => (
                <Box
                  key={i}
                  style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}
                >
                  <Paper
                    p="sm"
                    radius="md"
                    withBorder={m.role === 'assistant'}
                    bg={m.role === 'user' ? 'forest.9' : 'white'}
                    c={m.role === 'user' ? 'white' : undefined}
                  >
                    {m.role === 'assistant' ? (
                      m.content ? (
                        <JpMarkdown content={m.content} onNavigate={onClose} />
                      ) : (
                        <Loader size="xs" type="dots" />
                      )
                    ) : (
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {m.content}
                      </Text>
                    )}
                  </Paper>
                </Box>
              ))}

              {!streaming && followups.length > 0 && (
                <Group gap="xs" pt={4}>
                  {followups.map((q) => (
                    <Button
                      key={q}
                      variant="light"
                      color="forest"
                      size="compact-xs"
                      radius="xl"
                      onClick={() => send(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </Group>
              )}
            </Stack>
          )}
        </ScrollArea>

        <TextInput
          data-autofocus
          placeholder="Ask JP about your inventory…"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          disabled={streaming && !!lastIsEmptyAssistant}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rightSection={
            streaming ? (
              <Loader size="xs" />
            ) : (
              <ActionIcon variant="subtle" onClick={() => send(input)} disabled={!input.trim()}>
                <IconSend size={18} />
              </ActionIcon>
            )
          }
        />
        <Text size="xs" c="dimmed" ta="center">
          Press <Kbd size="xs">⌘</Kbd> <Kbd size="xs">K</Kbd> anywhere to open JP
        </Text>
      </Stack>
    </Modal>
  );
}
