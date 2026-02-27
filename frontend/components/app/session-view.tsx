'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useDataChannel, useSessionContext, useSessionMessages } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { TileLayout } from '@/components/app/tile-layout';
import { cn } from '@/lib/shadcn/utils';
import { Shimmer } from '../ai-elements/shimmer';

const MotionBottom = motion.create('div');

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const SHIMMER_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

interface Report {
  type: 'report';
  overallRating: string;
  topicScores: Array<{ topic: string; score: number; feedback: string }>;
  strengths: string[];
  areasForImprovement: string[];
}

function ReportCard({ report }: { report: Report }) {
  const ratingColor: Record<string, string> = {
    Excellent: 'text-green-600',
    Good: 'text-blue-600',
    Developing: 'text-amber-600',
    'Needs Work': 'text-red-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Session Report</h2>
        <p className={cn('mt-1 text-2xl font-bold', ratingColor[report.overallRating] ?? '')}>
          {report.overallRating}
        </p>

        {report.topicScores.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase">Topic Scores</h3>
            <div className="mt-2 space-y-2">
              {report.topicScores.map((ts, i) => (
                <div key={i} className="rounded-lg bg-neutral-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ts.topic}</span>
                    <span className="text-sm font-bold">{ts.score}/5</span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{ts.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.strengths.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-green-600 uppercase">Strengths</h3>
            <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-neutral-700">
              {report.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {report.areasForImprovement.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-amber-600 uppercase">Areas for Improvement</h3>
            <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-neutral-700">
              {report.areasForImprovement.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
}

export const SessionView = ({
  appConfig,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const onReportMessage = useCallback(
    (msg: { payload: Uint8Array }) => {
      try {
        const decoded = new TextDecoder().decode(msg.payload);
        const data = JSON.parse(decoded);
        if (data.type === 'report') {
          setReport(data as Report);
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    []
  );

  useDataChannel('report', onReportMessage);

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: appConfig.supportsChatInput,
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsScreenShare,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="bg-background relative z-10 h-svh w-svw overflow-hidden" {...props}>
      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />
      {/* transcript */}
      <ChatTranscript
        hidden={!chatOpen}
        messages={messages}
        className="space-y-3 transition-opacity duration-300 ease-out"
      />
      {/* Tile layout */}
      <TileLayout chatOpen={chatOpen} />
      {/* Report overlay */}
      <AnimatePresence>{report && <ReportCard report={report} />}</AnimatePresence>
      {/* Bottom */}
      <MotionBottom
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="fixed inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        {appConfig.isPreConnectBufferEnabled && (
          <AnimatePresence>
            {messages.length === 0 && (
              <MotionMessage
                key="pre-connect-message"
                duration={2}
                aria-hidden={messages.length > 0}
                {...SHIMMER_MOTION_PROPS}
                className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                Agent is listening, ask it a question
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </MotionBottom>
    </section>
  );
};
