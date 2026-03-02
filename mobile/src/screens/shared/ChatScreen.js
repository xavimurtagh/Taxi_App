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
import { getSocket } from '../../services/socket';

const ChatScreen = ({ route }) => {
  const { rideId, otherUserName } = route.params;
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
  };

  const cleanupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('chat:message', handleIncomingMessage);
    socket.off('chat:typing', handleTypingEvent);
  };

  const handleIncomingMessage = useCallback((data) => {
    if (data.rideId === rideId) {
      addMessage(rideId, data);
    }
  }, [rideId]);

  const handleTypingEvent = useCallback((data) => {
    if (data.rideId === rideId) {
      setTyping(rideId, true);
      // Clear typing indicator after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(rideId, false);
      }, 3000);
    }
  }, [rideId]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    sendMessage(rideId, trimmed);

    // Optimistically add the message
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      text: trimmed,
      sender: 'me',
      timestamp: new Date().toISOString(),
      isMine: true,
    };
    addMessage(rideId, optimisticMessage);
    setInputText('');
  };

  const handleTextChange = (text) => {
    setInputText(text);

    const socket = getSocket();
    if (socket && text.length > 0) {
      socket.emit('chat:typing', { rideId });
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.isMine || item.sender === 'me';
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
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text || item.message || item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMine ? styles.myMessageTime : styles.theirMessageTime,
            ]}
          >
            {formatDate(item.timestamp || item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isOtherTyping) return null;
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>{otherUserName} is typing...</Text>
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
    backgroundColor: COLORS.surfaceVariant,
    borderBottomLeftRadius: 4,
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
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: COLORS.textSecondary,
  },
  typingContainer: {
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  typingBubble: {
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
