// # ElectionStatusScreen.js
import React, { useEffect, useState, useMemo } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Modal, 
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator
} from "react-native";
import { db } from "./firebaseConfig";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

// Global image cache that persists across re-renders
const globalImageCache = new Map();

// Stable CandidateCard component that doesn't re-render unnecessarily
const StableCandidateCard = React.memo(({ candidate, position, index, totalVotes, totalCandidates }) => {
  const [imageState, setImageState] = useState(() => {
    // Get initial state from global cache
    return globalImageCache.get(candidate.photoURL) || { 
      loaded: false, 
      error: false,
      loading: false 
    };
  });

  const isTop = index === 0 && candidate.voteCount > 0;
  const votePercentage = totalVotes > 0 ? (candidate.voteCount / totalVotes * 100).toFixed(1) : 0;

  const handleImageLoad = () => {
    const newState = { loaded: true, error: false, loading: false };
    setImageState(newState);
    globalImageCache.set(candidate.photoURL, newState);
  };

  const handleImageError = () => {
    const newState = { loaded: true, error: true, loading: false };
    setImageState(newState);
    globalImageCache.set(candidate.photoURL, newState);
  };

  const handleImageLoadStart = () => {
    if (!imageState.loaded && !imageState.loading) {
      const newState = { loaded: false, error: false, loading: true };
      setImageState(newState);
      globalImageCache.set(candidate.photoURL, newState);
    }
  };

  // Use useMemo to prevent unnecessary re-renders
  const avatarContent = useMemo(() => {
    const showImage = candidate.photoURL && !imageState.error && imageState.loaded;
    const showLoading = candidate.photoURL && imageState.loading;
    const showPlaceholder = !candidate.photoURL || imageState.error;

    return (
      <View style={styles.imageWrapper}>
        {/* Image - always rendered but controlled by opacity */}
        {candidate.photoURL && (
          <Image
            source={{ uri: candidate.photoURL }}
            style={[
              styles.avatar,
              styles.avatarImage,
              (!imageState.loaded || imageState.error) && styles.avatarHidden
            ]}
            resizeMode="cover"
            onLoadStart={handleImageLoadStart}
            onLoad={handleImageLoad}
            onError={handleImageError}
            fadeDuration={0}
          />
        )}
        
        {/* Loading Indicator */}
        {showLoading && (
          <View style={styles.imageLoading}>
            <ActivityIndicator size="small" color="#004d40" />
          </View>
        )}
        
        {/* Placeholder - always rendered but hidden when image is shown */}
        <View style={[
          styles.avatarPlaceholder,
          (showImage && !showLoading) && styles.avatarHidden
        ]}>
          <Text style={styles.avatarText}>
            {candidate.name?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>
      </View>
    );
  }, [candidate.photoURL, candidate.name, imageState.loaded, imageState.error, imageState.loading]);

  return (
    <View style={[
      styles.candidateCard,
      candidate.isUserChoice && styles.userChoiceCard,
      isTop && styles.topCandidateCard,
    ]}>
      {/* Rank Badge */}
      <View style={styles.rankContainer}>
        <View style={[
          styles.rankBadge,
          index === 0 && styles.rankBadgeGold,
          index === 1 && styles.rankBadgeSilver,
          index === 2 && styles.rankBadgeBronze,
        ]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
      </View>

      {/* Candidate Info */}
      <View style={styles.candidateMain}>
        <View style={styles.candidateHeader}>
          <View style={styles.avatarContainer}>
            {avatarContent}
          </View>

          <View style={styles.candidateInfo}>
            <Text style={styles.candidateName} numberOfLines={1}>
              {candidate.name}
            </Text>
            <Text style={styles.candidatePosition}>{position}</Text>
            
            <View style={styles.badgeContainer}>
              {candidate.isUserChoice && (
                <View style={styles.userVoteBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                  <Text style={styles.userVoteText}>Your Vote</Text>
                </View>
              )}
              {candidate.isLeader && candidate.voteCount > 0 && (
                <View style={styles.leaderBadge}>
                  <Ionicons name="trophy" size={12} color="#fff" />
                  <Text style={styles.leaderText}>Leading</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Vote Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${votePercentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.percentageText}>{votePercentage}%</Text>
        </View>
      </View>

      {/* Vote Count */}
      <View style={styles.voteSection}>
        <Text style={styles.voteNumber}>{candidate.voteCount}</Text>
        <Text style={styles.voteLabel}>
          {candidate.voteCount === 1 ? "Vote" : "Votes"}
        </Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.candidate.id === nextProps.candidate.id &&
    prevProps.candidate.voteCount === nextProps.candidate.voteCount &&
    prevProps.candidate.isUserChoice === nextProps.candidate.isUserChoice &&
    prevProps.candidate.isLeader === nextProps.candidate.isLeader &&
    prevProps.index === nextProps.index &&
    prevProps.totalVotes === nextProps.totalVotes
  );
});

export default function ElectionStatusScreen() {
  const route = useRoute();
  const { eventId, votes: userVotes } = route.params || {};
  const [groupedCandidates, setGroupedCandidates] = useState({});
  const [eventTitle, setEventTitle] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [showWinnersModal, setShowWinnersModal] = useState(false);
  const [winners, setWinners] = useState({});
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  // 🔹 Define fixed order for positions
  const POSITION_ORDER = [
    "President",
    "Vice President", 
    "Treasurer",
    "Secretary"
  ];

  // 🔹 Sort positions based on predefined order
  const getSortedPositions = (groupedData) => {
    return Object.keys(groupedData).sort((a, b) => {
      const indexA = POSITION_ORDER.indexOf(a);
      const indexB = POSITION_ORDER.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return a.localeCompare(b);
    });
  };

  // 🔹 Helper to parse date + string times
  const parseDateTime = (dateStr, timeObj) => {
    if (!timeObj) return null;

    if (timeObj?.seconds) {
      return new Date(timeObj.seconds * 1000);
    } else if (typeof timeObj === "string" && dateStr) {
      return new Date(`${dateStr}T${timeObj}:00`);
    }
    return null;
  };

  // Animation on load
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  useEffect(() => {
    if (!eventId) return;

    // Listen to election info
    const electionRef = doc(db, "elections", eventId);
    const unsubscribeElection = onSnapshot(electionRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      if (data.title) setEventTitle(data.title);

      const parsedStart =
        data.startTimestamp?.toDate?.() || parseDateTime(data.date, data.startTime);
      const parsedEnd =
        data.endTimestamp?.toDate?.() || parseDateTime(data.date, data.endTime);

      setStartTime(parsedStart);
      setEndTime(parsedEnd);
    });

    // Listen to candidates subcollection
    const candidatesRef = collection(db, "elections", eventId, "candidates");
    const unsubscribeCandidates = onSnapshot(candidatesRef, (snap) => {
      const grouped = {};

      snap.forEach((candidateDoc) => {
        const candidateData = candidateDoc.data();
        if (!grouped[candidateData.position]) grouped[candidateData.position] = [];
        grouped[candidateData.position].push({
          ...candidateData,
          id: candidateDoc.id,
          voteCount: 0,
          isUserChoice: false,
          isLeader: false,
        });
      });

      setGroupedCandidates(grouped);
    });

    // FIXED: Listen to votes for current event only
    const votesQuery = query(collection(db, "votes"), where("eventId", "==", eventId));
    const unsubscribeVotes = onSnapshot(votesQuery, (snap) => {
      const voteCounts = {};
      const currentEventVoteCount = snap.size; // This now only counts votes for current event

      snap.forEach((voteDoc) => {
        const voteData = voteDoc.data();
        
        const userChoices = voteData.votes || {};
        Object.keys(userChoices).forEach((position) => {
          const candidateId = userChoices[position]?.candidateId;
          if (!candidateId) return;

          if (!voteCounts[position]) voteCounts[position] = {};
          if (!voteCounts[position][candidateId]) voteCounts[position][candidateId] = 0;

          voteCounts[position][candidateId] += 1;
        });
      });

      setTotalVotes(currentEventVoteCount);

      // Update groupedCandidates with vote counts
      setGroupedCandidates((prevGrouped) => {
        const updatedGrouped = { ...prevGrouped };
        const winnersObj = {};

        Object.keys(updatedGrouped).forEach((position) => {
          updatedGrouped[position] = updatedGrouped[position]
            .map((c) => ({
              ...c,
              voteCount: voteCounts[position]?.[c.id] || 0,
              isUserChoice: userVotes?.[position]?.candidateId === c.id,
            }))
            .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

          // Mark leader(s) and collect winners
          if (updatedGrouped[position].length > 0) {
            const maxVotes = updatedGrouped[position][0].voteCount;
            updatedGrouped[position] = updatedGrouped[position].map((c) => {
              const isLeader = c.voteCount === maxVotes && maxVotes > 0;
              if (isLeader) {
                if (!winnersObj[position]) winnersObj[position] = [];
                winnersObj[position].push(c);
              }
              return { ...c, isLeader };
            });
          }
        });

        setWinners(winnersObj);
        setLoading(false);
        return updatedGrouped;
      });
    });

    return () => {
      unsubscribeElection();
      unsubscribeCandidates();
      unsubscribeVotes();
    };
  }, [eventId, userVotes]);

  // 🔹 Show winners modal when time passes endTime
  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      if (endTime && now > endTime) {
        setShowWinnersModal(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // 🔹 Countdown Timer
  useEffect(() => {
    if (!endTime) return;
    const timer = setInterval(() => {
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) {
        setCountdown("Voting Ended");
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${hours}h ${minutes}m ${seconds}s remaining`);
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#004d40" />
        <Text style={styles.loadingText}>Loading Election Results...</Text>
      </View>
    );
  }

  const sortedPositions = getSortedPositions(groupedCandidates);
  const isElectionEnded = endTime && new Date() > endTime;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View 
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>{eventTitle || "Election Results"}</Text>
              <Text style={styles.subtitle}>Live Voting Dashboard</Text>
              
              {/* Stats Row */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{sortedPositions.length}</Text>
                  <Text style={styles.statLabel}>Positions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{totalVotes}</Text>
                  <Text style={styles.statLabel}>Total Votes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons 
                    name={isElectionEnded ? "checkmark-done-circle" : "time"} 
                    size={20} 
                    color={isElectionEnded ? "#16A34A" : "#f39c12"} 
                  />
                  <Text style={styles.statLabel}>
                    {isElectionEnded ? "Completed" : "Live"}
                  </Text>
                </View>
              </View>

              {/* Time Info */}
              {startTime && endTime && (
                <View style={styles.timeContainer}>
                  <View style={styles.timeRow}>
                    <Ionicons name="calendar" size={16} color="#666" />
                    <Text style={styles.timeText}>
                      {startTime.toLocaleDateString()} • {startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </View>
                  <View style={styles.countdownContainer}>
                    <Ionicons name="timer" size={16} color={isElectionEnded ? "#DC2626" : "#16A34A"} />
                    <Text style={[
                      styles.countdownText,
                      isElectionEnded && styles.countdownEnded
                    ]}>
                      {countdown}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Results by Position */}
          {sortedPositions.map((position) => (
            <View key={position} style={styles.positionSection}>
              {/* Position Header */}
              <View style={styles.positionHeader}>
                <View style={styles.positionTitleContainer}>
                  <Ionicons name="person-circle" size={20} color="#fff" />
                  <Text style={styles.positionTitle}>{position}</Text>
                </View>
                <View style={styles.candidateCount}>
                  <Text style={styles.candidateCountText}>
                    {groupedCandidates[position]?.length || 0} Candidates
                  </Text>
                </View>
              </View>

              {/* Candidates List */}
              <View style={styles.candidatesContainer}>
                {groupedCandidates[position]?.map((candidate, index) => (
                  <StableCandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    position={position}
                    index={index}
                    totalVotes={totalVotes}
                    totalCandidates={groupedCandidates[position]?.length}
                  />
                ))}
              </View>
            </View>
          ))}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              <Ionicons name="shield-checkmark" size={14} color="#666" />
              {" "}Results update in real-time
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Winners Modal */}
      <Modal visible={showWinnersModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="trophy" size={32} color="#FFD700" />
              <Text style={styles.modalTitle}>🏆 Election Results</Text>
              <Text style={styles.modalSubtitle}>Final Winners</Text>
            </View>
            
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {getSortedPositions(winners).map((position) => (
                <View key={position} style={styles.modalSection}>
                  <View style={styles.modalPositionHeader}>
                    <Text style={styles.modalPosition}>{position}</Text>
                    <View style={styles.winnerCount}>
                      <Text style={styles.winnerCountText}>
                        {winners[position].length} {winners[position].length === 1 ? 'Winner' : 'Winners'}
                      </Text>
                    </View>
                  </View>
                  
                  {winners[position].map((winner, index) => (
                    <View key={winner.id} style={styles.winnerCard}>
                      <View style={styles.winnerInfo}>
                        <Text style={styles.winnerName}>
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "•"} {winner.name}
                        </Text>
                        <Text style={styles.winnerVotes}>{winner.voteCount} votes</Text>
                      </View>
                      {winner.isUserChoice && (
                        <View style={styles.yourChoiceBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#fff" />
                          <Text style={styles.yourChoiceText}>Your Choice</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowWinnersModal(false)}
            >
              <Text style={styles.closeButtonText}>Close Results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC" 
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  animatedContainer: {
    flex: 1,
  },
  loader: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: "#F8FAFC"
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },

  // Header
  header: {
    backgroundColor: '#004d40',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 20,
  },
  headerContent: {
    padding: 25,
    paddingTop: 50,
  },
  title: { 
    fontSize: 28, 
    fontWeight: "bold", 
    color: "#fff", 
    textAlign: "center", 
    marginBottom: 5 
  },
  subtitle: { 
    fontSize: 16, 
    color: "rgba(255,255,255,0.8)", 
    textAlign: "center", 
    marginBottom: 20 
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Time Info
  timeContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 15,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 14,
    color: "#16A34A",
    fontWeight: "600",
    marginLeft: 8,
  },
  countdownEnded: {
    color: "#DC2626",
  },

  // Position Sections
  positionSection: {
    marginHorizontal: 15,
    marginBottom: 25,
  },
  positionHeader: {
    backgroundColor: "#1E293B",
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  positionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    color: "#fff", 
    marginLeft: 8 
  },
  candidateCount: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  candidateCountText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  candidatesContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },

  // Candidate Cards
  candidateCard: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  userChoiceCard: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#004d40',
  },
  topCandidateCard: {
    backgroundColor: '#f8fff0',
  },
  rankContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeGold: {
    backgroundColor: '#FFD700',
  },
  rankBadgeSilver: {
    backgroundColor: '#C0C0C0',
  },
  rankBadgeBronze: {
    backgroundColor: '#CD7F32',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  candidateMain: {
    flex: 1,
  },
  candidateHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatarContainer: {
    marginRight: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: 50,
    height: 50,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarHidden: {
    opacity: 0,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#004d40",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  imageLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    borderRadius: 25,
    zIndex: 2,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
  },
  candidatePosition: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  userVoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#004d40',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  userVoteText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 2,
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  leaderText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#004d40',
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    minWidth: 35,
  },
  voteSection: {
    alignItems: "center",
    justifyContent: 'center',
    minWidth: 60,
  },
  voteNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#004d40",
  },
  voteLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },

  // Footer
  footer: {
    alignItems: "center",
    padding: 20,
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "90%",
    maxHeight: "80%",
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#004d40',
    padding: 25,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 5,
  },
  modalScroll: {
    maxHeight: 400,
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalPositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalPosition: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  winnerCount: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winnerCountText: {
    fontSize: 12,
    color: '#004d40',
    fontWeight: '600',
  },
  winnerCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winnerInfo: {
    flex: 1,
  },
  winnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  winnerVotes: {
    fontSize: 14,
    color: '#666',
  },
  yourChoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  yourChoiceText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  closeButton: {
    backgroundColor: "#004d40",
    margin: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});