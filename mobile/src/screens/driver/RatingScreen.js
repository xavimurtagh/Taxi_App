import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { post } from '../../services/api';

const DriverRatingScreen = ({ navigation, route }) => {
  const ride = route.params?.ride;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passenger = ride?.passenger;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rideId = ride?.id || ride?._id;
      await post(`/rides/${rideId}/rate-passenger`, {
        rating,
        comment: comment.trim() || undefined,
      });
      Alert.alert('Thank you!', 'Your rating has been submitted.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigation.popToTop();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Rate Your Passenger</Text>
          <Text style={styles.subtitle}>
            Help the community by sharing your experience.
          </Text>
        </View>

        {/* Passenger Info */}
        {passenger && (
          <View style={styles.passengerContainer}>
            <View style={styles.passengerAvatar}>
              <Text style={styles.passengerAvatarText}>
                {(passenger.firstName || 'P')[0]}
              </Text>
            </View>
            <Text style={styles.passengerName}>
              {passenger.firstName} {passenger.lastName}
            </Text>
          </View>
        )}

        {/* Star Rating */}
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
            >
              <Text
                style={[
                  styles.starText,
                  star <= rating && styles.starTextSelected,
                ]}
              >
                {star <= rating ? '\u2605' : '\u2606'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingLabel}>
          {rating === 0
            ? 'Tap to rate'
            : rating <= 2
              ? 'Not great'
              : rating <= 3
                ? 'Okay'
                : rating === 4
                  ? 'Great passenger!'
                  : 'Excellent!'}
        </Text>

        {/* Comment */}
        <View style={styles.commentContainer}>
          <Text style={styles.commentLabel}>Additional comments (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            placeholderTextColor={COLORS.textLight}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  passengerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  passengerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  passengerName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  starButton: {
    paddingHorizontal: 6,
  },
  starText: {
    fontSize: 44,
    color: COLORS.border,
  },
  starTextSelected: {
    color: COLORS.star,
  },
  ratingLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  commentContainer: {
    width: '100%',
    marginBottom: 32,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 80,
  },
  submitButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});

export default DriverRatingScreen;
