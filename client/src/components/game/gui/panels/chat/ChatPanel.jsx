import React, { useState, useRef, useEffect } from "react";
import "./ChatPanel.scss";
import PubSub from "pubsub-js";
import {
    GUIState, PlayerState, ChatState,
} from "../../../../../shared/state/States";
import {
    FOCUS_CHAT, NEW_CHAT, SHOULD_SCROLL_CHAT,
} from "../../../../../shared/EventTypes";
import ChatLine from "./ChatLine";
import ChatSelectScope from "./ChatSelectScope";
import enterChatIcon from "../../../../../assets/images/gui/panels/chat/enter-chat-icon.png";
import ChatTabs from "./ChatTabs";
import Utils from "../../../../../shared/Utils";

function ChatPanel() {
    const defaultPlaceHolder = Utils.getTextDef("Enter message");
    const [chats, setChats] = useState(ChatState.chats);
    const [viewChatScope, setViewChatScope] = useState(ChatState.tabScope);
    const [sendChatScope, setSendChatScope] = useState(ChatState.chatScope);
    const [placeHolder, setPlaceHolder] = useState(defaultPlaceHolder);
    const [showSelectScopeDropdown, setShowSelectScopeDropdown] = useState(false);
    const chatContentsRef = useRef(null);
    const chatInputRef = useRef(null);
    let autoScroll = true;
    let placeHolderInterval;

    // auto scroll only if user is not scrolling upwards
    // if user is scrolling upwards it usually means the that user is back reading (auto-scroll = on)
    // if user scroll all the way down that means the user is done back reading (auto-scroll = off)
    const registerChatScrollWatcher = () => {
        let isSent = true;
        let pendingPublish;

        // debounce this so we don't blow up PubSub when user scrolls
        // no need to remove eventListener as it is automatically removed
        chatContentsRef.current.addEventListener("scroll", (e) => {
            if (isSent === false) clearTimeout(pendingPublish);
            const {
                scrollHeight,
                scrollTop,
                clientHeight,
            } = e.target;

            isSent = false;
            pendingPublish = setTimeout(() => {
                PubSub.publish(SHOULD_SCROLL_CHAT, scrollHeight - scrollTop === clientHeight);
                isSent = true;
            }, 300);
        });
    };

    const scrollChatToBottom = () => {
        if (!autoScroll) return;
        // add some delay to properly scroll down to edge of chats
        setTimeout(() => {
            if (GUIState.showChatBox) {
                chatContentsRef.current.scrollTop = chatContentsRef.current.scrollHeight;
            }
        }, 10);
    };

    const focusOnChatInput = () => chatInputRef.current.focus();

    const updatePlaceHolder = () => {
        const currentDate = Date.now();
        const targetDate = ChatState.getCoolDownDate(ChatState.chatScope);
        const secondsRemaining = (targetDate - currentDate) / 1000;

        if (secondsRemaining <= 0) setPlaceHolder(defaultPlaceHolder);
        else setPlaceHolder(`${Utils.getTextDef("Cooldown")}: ${Math.round(secondsRemaining)}`);
    };

    const refreshPlaceHolder = () => {
        placeHolderInterval = setInterval(() => updatePlaceHolder(), 1000);
    };

    useEffect(() => {
        const subs = [
            PubSub.subscribe(FOCUS_CHAT, () => {
                if (document.activeElement === chatInputRef.current) {
                    document.activeElement.blur();
                }
                else {
                    focusOnChatInput();
                }
            }),
            PubSub.subscribe(NEW_CHAT, (msg, data) => {
                setChats(data.chats);
                scrollChatToBottom();
            }),
            PubSub.subscribe(SHOULD_SCROLL_CHAT, (msg, data) => {
                autoScroll = data;
            }),
        ];

        scrollChatToBottom();

        registerChatScrollWatcher();

        refreshPlaceHolder();

        return () => {
            subs.forEach((sub) => {
                PubSub.unsubscribe(sub);
            });

            clearInterval(placeHolderInterval);
        };
    }, []);

    const sendChat = () => {
        const message = chatInputRef.current.value;

        if (!message) return;

        ChatState.send(sendChatScope, message);

        ChatState.setPendingChat("");

        chatInputRef.current.value = "";

        setPlaceHolder(`${Utils.getTextDef("Sending")}...`);
    };

    const handleChatInputChange = (e) => {
        ChatState.setPendingChat(e.target.value);

        if (e.key === "Enter") {
            sendChat();
        }
    };

    const handleSendBtnClick = () => sendChat();

    const toggleSelectScopeDropdown = () => {
        setShowSelectScopeDropdown((prevVal) => !prevVal);
    };

    const closeSelectScopeDropdown = () => {
        setShowSelectScopeDropdown(false);
    };

    const getScopeColor = (_scope) => {
        // return css class based on current scope
        if (_scope === ChatState.CHAT_SCOPES.LOCAL.value) return "local";
        if (_scope === ChatState.CHAT_SCOPES.GLOBAL.value) return "global";
        if (_scope === ChatState.CHAT_SCOPES.TRADE.value) return "trade";

        throw Error(`Chat scope ${_scope} not found`);
    };

    const filteredChats = () => {
        let newChats = chats;

        if (viewChatScope !== ChatState.generalChatScope) {
            newChats = newChats.filter((chat) => chat.scope === viewChatScope);
        }

        return newChats.map((chat) => (
            <ChatLine
              key={chat.id}
              scope={chat.scope}
              displayName={chat.displayName}
              message={chat.message}
              getScopeColor={getScopeColor}
            />
        ));
    };

    return (
        <div className="chat-container gui-scalable">
            <ChatTabs
              updatePlaceHolder={updatePlaceHolder}
              setViewChatScope={setViewChatScope}
              setSendChatScope={setSendChatScope}
              focusOnChatInput={focusOnChatInput}
              scrollChatToBottom={scrollChatToBottom}
              viewChatScope={viewChatScope}
              getScopeColor={getScopeColor}
            />
            <div className="chat-contents-wrapper">
                <div className="chat-contents" ref={chatContentsRef} onClick={closeSelectScopeDropdown}>
                    {filteredChats()}
                </div>
            </div>
            <div className="chat-input-container">
                <p
                  className={`player-name ${getScopeColor(sendChatScope)}`}
                  onClick={toggleSelectScopeDropdown}
                >
                    <span className="arrow">{`${showSelectScopeDropdown ? "⬇" : "⬆"}`}</span>
                    <span className="scope-label">{`(${sendChatScope})`}</span>
                    { `${PlayerState.displayName}:` }
                </p>
                <input
                  type="text"
                  className={`chat-input ${placeHolder !== defaultPlaceHolder ? "disabled" : ""} ${getScopeColor(sendChatScope)}`}
                  placeholder={placeHolder}
                  onKeyDown={handleChatInputChange}
                  onBlur={handleChatInputChange}
                  ref={chatInputRef}
                  defaultValue={ChatState.pendingChat}
                  maxLength={255}
                  autoFocus
                  autoComplete="off"
                  readOnly={placeHolder !== defaultPlaceHolder}
                />
                <button type="button" className="send-btn" onClick={handleSendBtnClick}>
                    <img className="send-btn-icon" src={enterChatIcon} alt="send" />
                </button>
            </div>
            { showSelectScopeDropdown && (
            <ChatSelectScope
              updatePlaceHolder={updatePlaceHolder}
              setSendChatScope={setSendChatScope}
              closeSelectScopeDropdown={closeSelectScopeDropdown}
            />
            ) }
        </div>
    );
}

export default ChatPanel;
