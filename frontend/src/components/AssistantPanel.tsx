import {
  ActionIcon,
  Badge,
  Box,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSend, IconSparkles } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAssistant, type ChatTurn } from '../api/assistant';
import { errorMessage } from '../api/client';

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
  const [input, setInput] = useState('');
  const assistant = useAssistant();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, assistant.isPending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || assistant.isPending) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    try {
      const reply = await assistant.mutateAsync({ message, history });
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: errorMessage(err) }]);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Group gap="xs">
          <IconSparkles size={18} color="var(--brand-forest)" />
          <Text fw={600}>JP</Text>
          <Badge size="xs" variant="light" color="forest">
            AI Ops Assistant
          </Badge>
        </Group>
      }
    >
      <Stack h="calc(100vh - 100px)" justify="space-between" gap="sm">
        <ScrollArea style={{ flex: 1 }} type="auto">
          <Stack gap="sm" pr="sm">
            {messages.length === 0 && (
              <Stack gap="xs" py="md">
                <Text size="sm" c="dimmed">
                  Ask about your inventory, stock and profitability. Try:
                </Text>
                {SUGGESTIONS.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    color="forest"
                    style={{ cursor: 'pointer', textTransform: 'none' }}
                    onClick={() => send(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </Stack>
            )}

            {messages.map((m, i) => (
              <Box
                key={i}
                style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}
              >
                <Paper
                  p="sm"
                  radius="md"
                  withBorder={m.role === 'assistant'}
                  bg={m.role === 'user' ? 'forest.9' : 'white'}
                  c={m.role === 'user' ? 'white' : undefined}
                >
                  {m.role === 'assistant' ? (
                    <div className="jp-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </Text>
                  )}
                </Paper>
              </Box>
            ))}

            {assistant.isPending && (
              <Box style={{ alignSelf: 'flex-start' }}>
                <Paper p="sm" radius="md" withBorder bg="white">
                  <Loader size="xs" type="dots" />
                </Paper>
              </Box>
            )}
            <div ref={bottomRef} />
          </Stack>
        </ScrollArea>

        <TextInput
          placeholder="Ask JP about your inventory…"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rightSection={
            <ActionIcon
              variant="subtle"
              onClick={() => send(input)}
              disabled={!input.trim() || assistant.isPending}
            >
              <IconSend size={18} />
            </ActionIcon>
          }
        />
      </Stack>
    </Drawer>
  );
}
