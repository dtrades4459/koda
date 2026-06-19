import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatMessage, type ChatMessageRow } from "./ChatMessage";
import { ChatComposer } from "./ChatComposer";
import { PinnedBanner } from "./PinnedBanner";
import { DARK } from "../theme";

const baseMsg: ChatMessageRow = {
  id: "m1",
  sender_id: "u-other",
  sender_name: "Bruno",
  sender_handle: "@bruno",
  text: "Took the London open long @dylon",
  created_at: new Date().toISOString(),
};

describe("ChatMessage (render smoke)", () => {
  it("renders the message text and sender handle", () => {
    render(
      <ChatMessage
        msg={baseMsg}
        isMe={false}
        myId="u-me"
        C={DARK}
        onReact={vi.fn()}
        onReply={vi.fn()}
      />
    );
    expect(screen.getByText(/Took the London open long/)).toBeInTheDocument();
    expect(screen.getByText("@bruno")).toBeInTheDocument();
  });

  it("renders reaction pills with counts and fires onReact when a pill is clicked", () => {
    const onReact = vi.fn();
    render(
      <ChatMessage
        msg={baseMsg}
        isMe={false}
        myId="u-me"
        C={DARK}
        reactions={{ "🔥": ["a", "b"] }}
        onReact={onReact}
        onReply={vi.fn()}
      />
    );
    const pill = screen.getByText(/🔥\s*2/);
    expect(pill).toBeInTheDocument();
    fireEvent.click(pill);
    expect(onReact).toHaveBeenCalledWith("m1", "🔥");
  });

  it("fires onReply with the message when Reply is clicked", () => {
    const onReply = vi.fn();
    render(
      <ChatMessage msg={baseMsg} isMe={false} myId="u-me" C={DARK} onReact={vi.fn()} onReply={onReply} />
    );
    fireEvent.click(screen.getByText("Reply"));
    expect(onReply).toHaveBeenCalledWith(baseMsg);
  });

  it("shows the reply quote when replyTo is provided", () => {
    const parent: ChatMessageRow = { ...baseMsg, id: "m0", sender_handle: "@kev", text: "anyone watching DAX?" };
    render(
      <ChatMessage
        msg={{ ...baseMsg, reply_to_id: "m0" }}
        isMe={false}
        myId="u-me"
        C={DARK}
        replyTo={parent}
        onReact={vi.fn()}
        onReply={vi.fn()}
      />
    );
    expect(screen.getByText(/anyone watching DAX/)).toBeInTheDocument();
  });

  it("shows the Pin affordance only when onPin is provided, and fires it", () => {
    const onPin = vi.fn();
    const { rerender } = render(
      <ChatMessage msg={baseMsg} isMe={false} myId="u-me" C={DARK} onReact={vi.fn()} onReply={vi.fn()} />
    );
    expect(screen.queryByText("Pin")).toBeNull();
    rerender(
      <ChatMessage msg={baseMsg} isMe={false} myId="u-me" C={DARK} onReact={vi.fn()} onReply={vi.fn()} onPin={onPin} />
    );
    fireEvent.click(screen.getByText("Pin"));
    expect(onPin).toHaveBeenCalledWith("m1");
  });

  it("only shows Delete for my own messages", () => {
    const onDelete = vi.fn();
    const { rerender } = render(
      <ChatMessage msg={baseMsg} isMe={false} myId="u-me" C={DARK} onReact={vi.fn()} onReply={vi.fn()} onDelete={onDelete} />
    );
    expect(screen.queryByText("Delete")).toBeNull();
    rerender(
      <ChatMessage msg={baseMsg} isMe={true} myId="u-me" C={DARK} onReact={vi.fn()} onReply={vi.fn()} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });
});

describe("ChatComposer (render smoke)", () => {
  it("renders the input and fires onSend on Enter (no shift)", () => {
    const onSend = vi.fn();
    render(
      <ChatComposer value="hello" onChange={vi.fn()} onSend={onSend} C={DARK} />
    );
    const input = screen.getByPlaceholderText("Message the circle…");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalled();
  });

  it("shows the reply context strip and fires onCancelReply", () => {
    const onCancelReply = vi.fn();
    render(
      <ChatComposer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        C={DARK}
        replyingTo={baseMsg}
        onCancelReply={onCancelReply}
      />
    );
    expect(screen.getByText(/Replying to @bruno/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Cancel reply"));
    expect(onCancelReply).toHaveBeenCalled();
  });

  it("fires onTyping on input change", () => {
    const onTyping = vi.fn();
    render(<ChatComposer value="" onChange={vi.fn()} onSend={vi.fn()} onTyping={onTyping} C={DARK} />);
    fireEvent.change(screen.getByPlaceholderText("Message the circle…"), { target: { value: "g" } });
    expect(onTyping).toHaveBeenCalled();
  });
});

describe("PinnedBanner (render smoke)", () => {
  it("renders the pinned sender + text and fires onUnpin when provided", () => {
    const onUnpin = vi.fn();
    render(<PinnedBanner senderName="Dylon" text="Comp starts Monday 09:00" C={DARK} onUnpin={onUnpin} />);
    expect(screen.getByText(/Pinned · Dylon/)).toBeInTheDocument();
    expect(screen.getByText(/Comp starts Monday/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Unpin"));
    expect(onUnpin).toHaveBeenCalled();
  });

  it("hides the unpin affordance for non-owners (no onUnpin)", () => {
    render(<PinnedBanner senderName="Dylon" text="hello" C={DARK} />);
    expect(screen.queryByLabelText("Unpin")).toBeNull();
  });
});
