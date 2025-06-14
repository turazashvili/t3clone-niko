
import { useChatCore } from "./useChatCore";
import { useChatActions } from "./useChatActions";

export function useChat() {
  const core = useChatCore();
  const actions = useChatActions(core);

  return {
    ...core,
    ...actions,
  };
}
