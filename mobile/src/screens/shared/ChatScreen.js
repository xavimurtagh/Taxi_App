import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import { getSocket } from '../../services/socket';

const ChatScreen = ({ route }) => {
  const { rideId, otherUserName } = route.params;
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { user } = useAuthStore();
  const currentUserId = user?.id || user?._id;

  const {
    messages,
    typing,
    unreadCounts,
    fetchMessages,
    sendMessage,
    addMessage,
    markAsRead,
    setTyping,
  } = useChatStore();

  const rideMessages = messages[rideId] || [];
  const isOtherTyping = typing[rideId] || false;
  const unreadCount = unreadCounts[rideId] || 0;

  useEffect(() => {
    loadMessages();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [rideId]);

  useEffect(() => {
    if (unreadCount > 0) {
      markAsRead(rideId);

      // Emit read event via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('chat:read', { rideId });
      }
    }
  }, [rideMessages.length]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      await fetchMessages(rideId);
    } catch (err) {
      // Messages may fail to load on first try
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:typing', handleTypingEvent);
    socket.on('chat:read', handleReadEvent);
  };

  const cleanupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('chat:message', handleIncomingMessage);
    socket.off('chat:typing', handleTypingEvent);
    socket.off('chat:read', handleReadEvent);
  };

  const handleIncomingMessage = useCallback(
    (data) => {
      if (data.rideId === rideId) {
        addMessage(rideId, data.message || data);
      }
    },
    [rideId]
  );

  const handleTypingEvent = useCallback(
    (data) => {
      if (data.rideId === rideId) {
        setTyping(rideId, data.isTyping !== undefined ? data.isTyping : true);

        // Clear typing indicator after 3 seconds if no explicit stop
        if (data.isTyping !== false) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setTyping(rideId, false);
          }, 3000);
        }
      }
    },
    [rideId]
  );

  const handleReadEvent = useCallback(
    (data) => {
      if (data.rideId === rideId) {
        markAsRead(rideId);
      }
    },
    [rideId]
  );

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    sendMessage(rideId, trimmed);

    // Optimistically add the message
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      text: trimmed,
      sender: currentUserId || 'me',
      senderId: currentUserId,
      senderName: user?.firstName || 'You',
      timestamp: new Date().toISOString(),
      isMine: true,
      isRead: false,
      isSystem: false,
    };
    addMessage(rideId, optimisticMessage);
    setInputText('');

    // Stop typing indicator
    const socket = getSocket();
    if (socket) {
      socket.emit('chat:typing', { rideId, isTyping: false });
    }
  };

  const handleTextChange = (text) => {
    setInputText(text);

    const socket = getSocket();
    if (socket && text.length > 0) {
      socket.emit('chat:typing', { rideId, isTyping: true });
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderMessage = ({ item }) => {
    const isSystem = item.isSystem || item.type === 'system';
    const isMine =
      item.isMine ||
      item.sender === 'me' ||
      item.senderId === currentUserId ||
      item.sender === currentUserId;

    // System messages are centered and styled differently
    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>
            {item.text || item.message || item.content}
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isMine ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myMessageBubble : styles.theirMessageBubble,
          ]}
        >
          {/* Sender name for other user's messages */}
          {!isMine && (
            <Text style={styles.senderName}>
              {item.senderName || otherUserName || 'Unknown'}
            </Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text || item.message || item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : styles.theirMessageTime,
              ]}
            >
              {formatMessageTime(item.timestamp || item.createdAt)}
            </Text>
            {/* Read status for own messages */}
            {isMine && (
              <Text
                style={[
                  styles.readStatus,
                  item.isRead && styles.readStatusRead,
                ]}
              >
                {item.isRead ? '\u2713\u2713' : '\u2713'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isOtherTyping) return null;
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {otherUserName || 'Someone'} is typing
          </Text>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          Send a message to start the conversation
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={rideMessages}
        renderItem={renderMessage}
        keyExtractor={(item, index) =>
          item.id || item._id || `msg-${index}`
        }
        inverted
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={renderTypingIndicator}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (rideMessages.length > 0) {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textLight}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>{'\u2191'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: COLORS.textOnPrimary,
  },
  theirMessageText: {
    color: COLORS.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: COLORS.textSecondary,
  },
  readStatus: {
    fontSize: 12,
    marginLeft: 4,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  readStatusRead: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  systemMessageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  typingContainer: {
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginRight: 6,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textSecondary,
    marginHorizontal: 1,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  sendButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
});

export default ChatScreen;
