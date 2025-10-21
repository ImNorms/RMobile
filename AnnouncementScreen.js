// AnnouncementScreen.js - Enhanced Likes Version
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  Alert,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  deleteDoc,
  getDocs,
  where,
  getCountFromServer,
  limit,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AnnouncementScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentTexts, setCommentTexts] = useState({});
  const [comments, setComments] = useState({});
  const [reacts, setReacts] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [selectedPost, setSelectedPost] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  const [imageDimensions, setImageDimensions] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [userProfiles, setUserProfiles] = useState({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [commentMenuVisible, setCommentMenuVisible] = useState(null);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [selectedPostLikes, setSelectedPostLikes] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const storage = getStorage();

  const adminUIDs = ["ADMIN_UID_1", "ADMIN_UID_2"];

  const unsubscribeRefs = useRef({
    posts: null,
    comments: {},
    reacts: {},
    auth: null,
    userProfile: null,
    latestPost: null
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const cleanupAllListeners = useCallback(() => {
    if (unsubscribeRefs.current.posts) {
      unsubscribeRefs.current.posts();
      unsubscribeRefs.current.posts = null;
    }

    Object.values(unsubscribeRefs.current.comments).forEach(unsubscribe => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribeRefs.current.comments = {};

    Object.values(unsubscribeRefs.current.reacts).forEach(unsubscribe => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribeRefs.current.reacts = {};

    if (unsubscribeRefs.current.userProfile) {
      unsubscribeRefs.current.userProfile();
      unsubscribeRefs.current.userProfile = null;
    }

    if (unsubscribeRefs.current.latestPost) {
      unsubscribeRefs.current.latestPost();
      unsubscribeRefs.current.latestPost = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted.current) return;

      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        cleanupAllListeners();
        setPosts([]);
        setComments({});
        setReacts({});
        setCommentTexts({});
        setCommentCounts({});
        setSelectedPost(null);
        setEditingComment(null);
        setCommentMenuVisible(null);
        setUserProfiles({});
        setLoading(false);
      }
    });

    unsubscribeRefs.current.auth = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.auth) {
        unsubscribeRefs.current.auth();
      }
    };
  }, [cleanupAllListeners]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const updateUserNameInAllComments = async (userId, newName, newPhotoURL = null) => {
    if (!userId || !newName || !isAuthenticated) return;
    
    try {
      const postsQuery = query(collection(db, "posts"));
      const postsSnapshot = await getDocs(postsQuery);
      
      const batch = writeBatch(db);
      let updatedCommentsCount = 0;

      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        
        const commentsQuery = query(
          collection(db, "posts", postId, "comments"),
          where("userId", "==", userId)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        
        commentsSnapshot.forEach((commentDoc) => {
          const commentRef = doc(db, "posts", postId, "comments", commentDoc.id);
          const updateData = {
            authorName: newName,
            userName: newName,
            user: newName
          };
          
          if (newPhotoURL) {
            updateData.photoURL = newPhotoURL;
          }
          
          batch.update(commentRef, updateData);
          updatedCommentsCount++;
        });
      }

      if (updatedCommentsCount > 0) {
        await batch.commit();
        await updateUserNameInAllReacts(userId, newName, newPhotoURL);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const updateUserNameInAllReacts = async (userId, newName, newPhotoURL = null) => {
    if (!userId || !newName || !isAuthenticated) return;
    
    try {
      const postsQuery = query(collection(db, "posts"));
      const postsSnapshot = await getDocs(postsQuery);
      
      const batch = writeBatch(db);
      let updatedReactsCount = 0;

      for (const postDoc of postsSnapshot.docs) {
        const postId = postDoc.id;
        
        const reactsQuery = query(
          collection(db, "posts", postId, "reacts"),
          where("userId", "==", userId)
        );
        const reactsSnapshot = await getDocs(reactsQuery);
        
        reactsSnapshot.forEach((reactDoc) => {
          const reactRef = doc(db, "posts", postId, "reacts", reactDoc.id);
          const updateData = {
            authorName: newName
          };
          
          if (newPhotoURL) {
            updateData.photoURL = newPhotoURL;
          }
          
          batch.update(reactRef, updateData);
          updatedReactsCount++;
        });
      }

      if (updatedReactsCount > 0) {
        await batch.commit();
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const getUserProfileData = async (userId) => {
    if (!userId || !isAuthenticated) return { name: "User", photoURL: null };
    
    try {
      if (userProfiles[userId]) {
        return userProfiles[userId];
      }
      
      if (userId === currentUser?.uid) {
        const userRef = doc(db, "members", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const profileData = {
            name: userData.name || userData.displayName || "User",
            photoURL: userData.photoURL || null
          };
          
          setUserProfiles(prev => ({
            ...prev,
            [userId]: profileData
          }));
          
          return profileData;
        }
      }
      
      return { name: "User", photoURL: null };
      
    } catch (error) {
      if (error.code === 'permission-denied' || error.code === 'missing-or-insufficient-permissions') {
        return { name: "User", photoURL: null };
      }
      return { name: "User", photoURL: null };
    }
  };

  useEffect(() => {
    if (!currentUser || !isAuthenticated) return;

    const userRef = doc(db, "members", currentUser.uid);
    
    const unsubscribe = onSnapshot(userRef, async (userSnap) => {
      if (!isMounted.current || !isAuthenticated) return;

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const newName = userData.name || userData.displayName;
        const newPhotoURL = userData.photoURL || null;
        const oldName = userProfiles[currentUser.uid]?.name;
        const oldPhotoURL = userProfiles[currentUser.uid]?.photoURL;

        if (newName && oldName && (newName !== oldName || newPhotoURL !== oldPhotoURL)) {
          await updateUserNameInAllComments(currentUser.uid, newName, newPhotoURL);
        }

        setUserProfiles(prev => ({
          ...prev,
          [currentUser.uid]: {
            name: newName || "User",
            photoURL: newPhotoURL
          }
        }));
      }
    }, (error) => {
      // Silent error handling for permission errors
    });

    unsubscribeRefs.current.userProfile = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.userProfile) {
        unsubscribeRefs.current.userProfile();
        unsubscribeRefs.current.userProfile = null;
      }
    };
  }, [currentUser, isAuthenticated]);

  const getLastSeenAnnouncement = async (uid) => {
    if (!uid) return null;
    return await AsyncStorage.getItem(`lastSeenAnnouncement_${uid}`);
  };

  const setLastSeenAnnouncement = async (uid, timestamp) => {
    if (!uid) return;
    await AsyncStorage.setItem(`lastSeenAnnouncement_${uid}`, String(timestamp));
  };

  useEffect(() => {
    if (!currentUser?.uid || !isAuthenticated) return;

    const latestPostQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(latestPostQuery, async (snapshot) => {
      if (!isMounted.current || !isAuthenticated) return;

      if (!snapshot.empty) {
        const latestPost = snapshot.docs[0].data();
        const latestTimestamp = latestPost.createdAt?.seconds || 0;

        const lastSeenRaw = await getLastSeenAnnouncement(currentUser.uid);
        const lastSeen = Number(lastSeenRaw) || 0;

        if (!lastSeenRaw) {
          await setLastSeenAnnouncement(currentUser.uid, latestTimestamp);
          navigation.setParams({ hasNewAnnouncement: false });
        } else {
          navigation.setParams({
            hasNewAnnouncement: latestTimestamp > lastSeen,
          });
        }
      }
    });

    unsubscribeRefs.current.latestPost = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.latestPost) {
        unsubscribeRefs.current.latestPost();
        unsubscribeRefs.current.latestPost = null;
      }
    };
  }, [currentUser, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (posts.length > 0 && currentUser?.uid && isAuthenticated) {
        const latest = posts[0].createdAt?.seconds;
        if (latest) {
          setLastSeenAnnouncement(currentUser.uid, latest);
          navigation.setParams({ hasNewAnnouncement: false });
        }
      }
    }, [posts, currentUser, isAuthenticated])
  );

  const fetchUserProfile = async (userId) => {
    if (!userId || userProfiles[userId] || !isAuthenticated) return;
    
    try {
      if (userId === currentUser?.uid) {
        const userRef = doc(db, "members", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfiles(prev => ({
            ...prev,
            [userId]: {
              name: userData.name || userData.displayName || "User",
              photoURL: userData.photoURL || null
            }
          }));
        }
      }
    } catch (error) {
      // Handle permission errors silently
    }
  };

  const getCommentCount = async (postId) => {
    if (!isAuthenticated || !isMounted.current) {
      return 0;
    }
    
    try {
      const commentsRef = collection(db, "posts", postId, "comments");
      const snapshot = await getCountFromServer(commentsRef);
      return snapshot.data().count;
    } catch (error) {
      if (error.code === 'permission-denied' || error.code === 'missing-or-insufficient-permissions') {
        const commentsCount = comments[postId]?.length || 0;
        return commentsCount;
      }
      return 0;
    }
  };

  const hasUserReacted = (postId) => {
    return (
      reacts[postId]?.some((react) => react.userId === currentUser?.uid) || false
    );
  };

  // ENHANCED: Optimistic UI update for likes
  const toggleLike = async (postId) => {
    if (!currentUser?.uid || !isAuthenticated) {
      Alert.alert("Authentication Required", "Please log in to like posts");
      return;
    }

    try {
      const hasLiked = hasUserReacted(postId);
      const currentPost = posts.find((p) => p.id === postId);
      const currentReactsCount = currentPost?.reactsCount || 0;

      // Optimistic update - update UI immediately
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactsCount: hasLiked
                  ? Math.max(0, currentReactsCount - 1)
                  : currentReactsCount + 1,
              }
            : post
        )
      );

      // Optimistic update for reacts state
      const userProfile = await getUserProfileData(currentUser.uid);
      
      if (hasLiked) {
        setReacts((prev) => ({
          ...prev,
          [postId]: (prev[postId] || []).filter((r) => r.userId !== currentUser.uid),
        }));
      } else {
        const tempReact = {
          id: `temp-${Date.now()}`,
          userId: currentUser.uid,
          authorName: userProfile.name || currentUser.displayName || "User",
          photoURL: userProfile.photoURL || currentUser.photoURL || null,
          createdAt: { seconds: Date.now() / 1000 },
          type: "like",
        };
        setReacts((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), tempReact],
        }));
      }

      // Perform the actual database operation
      const reactsRef = collection(db, "posts", postId, "reacts");
      const userReactQuery = query(
        reactsRef,
        where("userId", "==", currentUser.uid)
      );

      const snapshot = await getDocs(userReactQuery);
      const postRef = doc(db, "posts", postId);

      const userPhotoURL = userProfile.photoURL || currentUser.photoURL || null;
      const userName = userProfile.name || currentUser.displayName || "User";

      if (snapshot.empty) {
        await addDoc(reactsRef, {
          userId: currentUser.uid,
          authorName: userName,
          photoURL: userPhotoURL,
          createdAt: serverTimestamp(),
          type: "like",
        });
        await updateDoc(postRef, {
          reactsCount: currentReactsCount + 1,
        });
      } else {
        const reactDoc = snapshot.docs[0];
        await deleteDoc(doc(db, "posts", postId, "reacts", reactDoc.id));
        await updateDoc(postRef, {
          reactsCount: Math.max(0, currentReactsCount - 1),
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      const currentPost = posts.find((p) => p.id === postId);
      if (currentPost && isMounted.current) {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? { ...post, reactsCount: currentPost.reactsCount }
              : post
          )
        );
      }
      Alert.alert("Error", "Failed to update like. Please try again.");
    }
  };

  const addComment = async (postId, currentCommentsCount) => {
    const text = commentTexts[postId];
    if (!text?.trim() || !currentUser?.uid || !isAuthenticated) {
      Alert.alert("Authentication Required", "Please log in to comment");
      return;
    }

    try {
      const commentsRef = collection(db, "posts", postId, "comments");

      const userProfile = await getUserProfileData(currentUser.uid);
      const userPhotoURL = userProfile.photoURL || currentUser.photoURL || null;
      const userName = userProfile.name || currentUser.displayName || "Anonymous";

      await addDoc(commentsRef, {
        text: text.trim(),
        authorName: userName,
        userId: currentUser.uid,
        userName: userName,
        photoURL: userPhotoURL,
        isAdmin: adminUIDs.includes(currentUser.uid),
        createdAt: serverTimestamp(),
      });

      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentsCount: (currentCommentsCount || 0) + 1,
      });

      setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
    } catch (error) {
      // Silent error handling
    }
  };

  const deleteComment = async (postId, commentId, currentCommentsCount) => {
    if (!isAuthenticated) {
      Alert.alert("Authentication Required", "Please log in to delete comments");
      return;
    }

    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setCommentMenuVisible(null)
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", postId, "comments", commentId));
              const postRef = doc(db, "posts", postId);
              await updateDoc(postRef, {
                commentsCount: Math.max(0, (currentCommentsCount || 1) - 1),
              });
              setCommentMenuVisible(null);
            } catch (error) {
              Alert.alert("Error", "Failed to delete comment");
            }
          }
        }
      ]
    );
  };

  const startEditComment = (comment) => {
    setEditingComment(comment);
    setEditText(comment.text);
    setCommentMenuVisible(null);
  };

  const saveEditedComment = async (postId, commentId) => {
    if (!editText.trim() || !isAuthenticated) return;

    try {
      const commentRef = doc(db, "posts", postId, "comments", commentId);
      await updateDoc(commentRef, { text: editText.trim() });
      setEditingComment(null);
      setEditText("");
    } catch (error) {
      Alert.alert("Error", "Failed to update comment");
    }
  };

  const cancelEditComment = () => {
    setEditingComment(null);
    setEditText("");
  };

  const toggleCommentMenu = (commentId) => {
    setCommentMenuVisible(commentMenuVisible === commentId ? null : commentId);
  };

  const handleImageError = (postId, error) => {
    setImageErrors((prev) => ({ ...prev, [postId]: true }));
    setImageLoadingStates((prev) => ({ ...prev, [postId]: false }));
  };

  const handleImageLoad = (postId, event) => {
    const { width, height } = event.nativeEvent.source;
    setImageDimensions((prev) => ({ ...prev, [postId]: { width, height } }));
    setImageLoadingStates((prev) => ({ ...prev, [postId]: false }));
  };

  const handleImageLoadStart = (postId) => {
    setImageLoadingStates((prev) => ({ ...prev, [postId]: true }));
  };

  const calculateImageHeight = (postId, containerWidth = screenWidth - 50) => {
    const dimensions = imageDimensions[postId];
    if (!dimensions) return 200;
    const aspectRatio = dimensions.width / dimensions.height;
    const calculatedHeight = containerWidth / aspectRatio;
    return Math.min(Math.max(calculatedHeight, 150), 400);
  };

  // ENHANCED: Format time ago
  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    
    return "Just now";
  };

  const showLikesModal = (postId) => {
    const postReacts = reacts[postId] || [];
    setSelectedPostLikes(postReacts);
    setLikesModalVisible(true);
  };

  const closeLikesModal = () => {
    setLikesModalVisible(false);
    setSelectedPostLikes([]);
  };

  const handleLogout = async () => {
    try {
      cleanupAllListeners();
      
      setPosts([]);
      setComments({});
      setReacts({});
      setCommentTexts({});
      setCommentCounts({});
      setSelectedPost(null);
      setEditingComment(null);
      setCommentMenuVisible(null);
      setUserProfiles({});
      setLoading(false);
      
      const auth = getAuth();
      await signOut(auth);
      
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Logout failed", error.message);
    }
  };

  const renderUserAvatar = (userId, photoURL = null, size = 32) => {
    const userProfile = userProfiles[userId];
    const avatarPhotoURL = photoURL || userProfile?.photoURL;
    
    if (avatarPhotoURL) {
      return (
        <Image
          source={{ uri: avatarPhotoURL }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      );
    }
    
    const displayName = userProfile?.name || "U";
    return (
      <View style={[styles.commentAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.commentAvatarText}>
          {displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  const renderPostContent = (item, isInModal = false) => (
    <View style={[styles.postContainer, isInModal && styles.modalPostContainer]}>
      <View style={styles.postHeader}>
        {renderUserAvatar(item.author?.uid || "default", null, 40)}
        <View style={styles.postHeaderInfo}>
          <Text style={styles.authorName}>
            {item.author?.name || "HOA Member"}
          </Text>
          <Text style={styles.postTime}>
            {item.createdAt
              ? new Date(item.createdAt.seconds * 1000).toLocaleString()
              : "Date not available"}
          </Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {item.category?.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.postContent}>
        <Text style={styles.postContentText}>{item.title}</Text>

        {item.imageUrl &&
        !imageErrors[item.id] &&
        item.imageUrl.trim() !== "" &&
        !item.imageUrl.includes("via.placeholder.com") ? (
          <View style={styles.imageContainer}>
            {imageLoadingStates[item.id] && !imageDimensions[item.id] ? (
              <View
                style={[
                  styles.imageLoader,
                  { height: calculateImageHeight(item.id, isInModal ? screenWidth - 32 : screenWidth - 50) },
                ]}
              >
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading image...</Text>
              </View>
            ) : null}
            <Image
              source={{
                uri: item.imageUrl,
                cache: "force-cache",
              }}
              style={[
                styles.postImage,
                {
                  height: calculateImageHeight(item.id, isInModal ? screenWidth - 32 : screenWidth - 50),
                  minHeight: 150,
                },
              ]}
              resizeMode="contain"
              onLoadStart={() => handleImageLoadStart(item.id)}
              onLoad={(event) => handleImageLoad(item.id, event)}
              onError={(error) => handleImageError(item.id, error)}
            />
          </View>
        ) : null}

        {imageErrors[item.id] && (
          <View style={styles.imageError}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
            <Text style={styles.imageErrorText}>Image failed to load</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setImageErrors((prev) => ({ ...prev, [item.id]: false }));
                setImageLoadingStates((prev) => ({ ...prev, [item.id]: true }));
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ENHANCED: Post stats with better visuals */}
      <View style={styles.postStats}>
        <TouchableOpacity 
          onPress={() => showLikesModal(item.id)}
          style={styles.statButton}
          disabled={!item.reactsCount || item.reactsCount === 0}
        >
          <View style={styles.reactIconsContainer}>
            {item.reactsCount > 0 && (
              <View style={styles.reactIcon}>
                <Ionicons name="heart" size={16} color="#e74c3c" />
              </View>
            )}
          </View>
          <Text style={[styles.statText, styles.likesCount]}>
            {item.reactsCount > 0 ? (
              `${item.reactsCount} ${item.reactsCount === 1 ? 'like' : 'likes'}`
            ) : (
              'Be the first to like'
            )}
          </Text>
        </TouchableOpacity>
        <Text style={styles.statText}>
          {commentCounts[item.id] || 0} {(commentCounts[item.id] || 0) === 1 ? 'comment' : 'comments'}
        </Text>
      </View>

      {/* ENHANCED: Action buttons with better text */}
      {!isInModal && (
        <View style={styles.postActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              hasUserReacted(item.id) && styles.activeActionButton,
            ]}
            onPress={() => toggleLike(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons
                name={hasUserReacted(item.id) ? "heart" : "heart-outline"}
                size={22}
                color={hasUserReacted(item.id) ? "#e74c3c" : "#555"}
              />
            </View>
            <Text
              style={[
                styles.actionText,
                hasUserReacted(item.id) && styles.activeActionText,
              ]}
            >
              {hasUserReacted(item.id) ? "Liked" : "Like"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setSelectedPost(item)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="chatbubble-outline" size={20} color="#555" />
            </View>
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      async (snapshot) => {
        if (!isMounted.current || !isAuthenticated) {
          return;
        }

        const postsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const imageUrl = data.mediaUrl || data.imageUrl || "";
          return {
            id: docSnap.id,
            ...data,
            title: data.content || "No content available",
            author: { name: data.authorName || "HOA Member" },
            createdAt: data.createdAt,
            imageUrl: imageUrl,
            category: data.category || "announcement",
            reactsCount: data.reactsCount || 0,
            commentsCount: data.commentsCount || 0,
          };
        });

        setPosts(postsData);
        setLoading(false);

        const counts = {};
        for (const post of postsData) {
          if (!isMounted.current || !isAuthenticated) {
            break;
          }
          try {
            counts[post.id] = await getCommentCount(post.id);
          } catch (error) {
            counts[post.id] = 0;
          }
        }
        
        if (isMounted.current && isAuthenticated) {
          setCommentCounts(counts);
        }

        Object.values(unsubscribeRefs.current.comments).forEach(unsubscribe => {
          if (unsubscribe && typeof unsubscribe === 'function') {
            unsubscribe();
          }
        });
        Object.values(unsubscribeRefs.current.reacts).forEach(unsubscribe => {
          if (unsubscribe && typeof unsubscribe === 'function') {
            unsubscribe();
          }
        });
        unsubscribeRefs.current.comments = {};
        unsubscribeRefs.current.reacts = {};

        postsData.forEach((post) => {
          if (!isMounted.current || !isAuthenticated) return;

          const commentsQuery = query(
            collection(db, "posts", post.id, "comments"),
            orderBy("createdAt", "asc")
          );

          const unsubscribeComments = onSnapshot(
            commentsQuery,
            (commentsSnapshot) => {
              if (!isMounted.current || !isAuthenticated) return;
              
              const postComments = commentsSnapshot.docs.map((commentDoc) => {
                const commentData = commentDoc.data();
                
                if (commentData.userId === currentUser?.uid) {
                  fetchUserProfile(commentData.userId);
                }
                
                return {
                  id: commentDoc.id,
                  text: commentData.text || commentData.content || "",
                  user:
                    commentData.authorName ||
                    commentData.user ||
                    commentData.userName ||
                    "Anonymous",
                  isAdmin: commentData.isAdmin || false,
                  createdAt: commentData.createdAt,
                  userId: commentData.userId,
                  photoURL: commentData.photoURL || null,
                  ...commentData,
                };
              });
              setComments((prev) => ({ ...prev, [post.id]: postComments }));
              setCommentCounts((prev) => ({
                ...prev,
                [post.id]: commentsSnapshot.size,
              }));
            },
            (error) => {
              // Silent error handling
            }
          );

          const reactsQuery = query(collection(db, "posts", post.id, "reacts"));
          const unsubscribeReacts = onSnapshot(
            reactsQuery,
            (reactsSnapshot) => {
              if (!isMounted.current || !isAuthenticated) return;
              
              const postReacts = reactsSnapshot.docs.map((reactDoc) => {
                const reactData = reactDoc.data();
                
                if (reactData.userId === currentUser?.uid) {
                  fetchUserProfile(reactData.userId);
                }
                
                return {
                  id: reactDoc.id,
                  ...reactData,
                  photoURL: reactData.photoURL || null,
                };
              });
              setReacts((prev) => ({ ...prev, [post.id]: postReacts }));
            },
            (error) => {
              // Silent error handling
            }
          );

          unsubscribeRefs.current.comments[post.id] = unsubscribeComments;
          unsubscribeRefs.current.reacts[post.id] = unsubscribeReacts;
        });
      },
      (error) => {
        if (isMounted.current && isAuthenticated) {
          setLoading(false);
        }
      }
    );

    unsubscribeRefs.current.posts = unsubscribePosts;

    return () => {
      if (unsubscribeRefs.current.posts) {
        unsubscribeRefs.current.posts();
        unsubscribeRefs.current.posts = null;
      }
    };
  }, [isAuthenticated]);

  const renderItem = ({ item }) => renderPostContent(item, false);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="log-in-outline" size={64} color="#ccc" />
          <Text style={styles.empty}>Please log in to view announcements</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Ionicons name="log-in" size={22} color="#fff" />
            <Text style={styles.footerText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No announcements yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Modern Comment Modal with Post */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        onRequestClose={() => {
          setSelectedPost(null);
          setCommentMenuVisible(null);
          cancelEditComment();
        }}
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Text style={styles.modalTitle}>Post & Comments</Text>
              <Text style={styles.commentCountHeader}>
                {commentCounts[selectedPost?.id] || 0} comments
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedPost(null);
                setCommentMenuVisible(null);
                cancelEditComment();
              }}
            >
              <Ionicons name="close" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.modalContentContainer,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight + (editingComment ? 220 : 100) : (editingComment ? 220 : 100) }
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {selectedPost && renderPostContent(selectedPost, true)}

            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>Comments</Text>
              
              {selectedPost && comments[selectedPost.id]?.length > 0 ? (
                comments[selectedPost.id].map((comment) => (
                  <View
                    key={comment.id}
                    style={[
                      styles.commentItem,
                      comment.isAdmin && styles.adminCommentItem,
                    ]}
                  >
                    {renderUserAvatar(comment.userId, comment.photoURL, 40)}
                    
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAuthorContainer}>
                          <Text
                            style={[
                              styles.commentAuthor,
                              comment.isAdmin && styles.adminAuthor,
                            ]}
                          >
                            {comment.user}
                          </Text>
                          {comment.isAdmin && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>Admin</Text>
                            </View>
                          )}
                        </View>
                        
                        {(comment.userId === currentUser?.uid ||
                          adminUIDs.includes(currentUser?.uid)) &&
                          !editingComment && (
                          <TouchableOpacity
                            style={styles.commentMenuButton}
                            onPress={() => toggleCommentMenu(comment.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color="#65676b" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.commentText}>{comment.text}</Text>
                      
                      <Text style={styles.commentTime}>
                        {comment.createdAt
                          ? new Date(
                              comment.createdAt.seconds * 1000
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </Text>

                      {commentMenuVisible === comment.id && (
                        <Modal
                          transparent
                          visible={true}
                          animationType="fade"
                          onRequestClose={() => setCommentMenuVisible(null)}
                        >
                          <TouchableOpacity 
                            style={styles.commentMenuOverlay}
                            activeOpacity={1}
                            onPress={() => setCommentMenuVisible(null)}
                          >
                            <View style={styles.commentMenuModal}>
                              <View style={styles.commentMenuContent}>
                                <TouchableOpacity
                                  style={styles.commentMenuItem}
                                  onPress={() => startEditComment(comment)}
                                >
                                  <Ionicons name="create-outline" size={20} color="#1a1a1a" />
                                  <Text style={styles.commentMenuItemText}>Edit Comment</Text>
                                </TouchableOpacity>
                                <View style={styles.commentMenuDivider} />
                                <TouchableOpacity
                                  style={[styles.commentMenuItem, styles.deleteMenuItem]}
                                  onPress={() =>
                                    deleteComment(
                                      selectedPost.id,
                                      comment.id,
                                      selectedPost.commentsCount
                                    )
                                  }
                                >
                                  <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                                  <Text style={[styles.commentMenuItemText, styles.deleteMenuItemText]}>
                                    Delete Comment
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              <TouchableOpacity
                                style={styles.commentMenuCancel}
                                onPress={() => setCommentMenuVisible(null)}
                              >
                                <Text style={styles.commentMenuCancelText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        </Modal>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noComments}>
                  <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                  <Text style={styles.noCommentsText}>No comments yet</Text>
                  <Text style={styles.noCommentsSubtext}>
                    Be the first to comment on this post
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {editingComment && (
            <View style={[
              styles.editCommentContainer,
              { bottom: keyboardHeight }
            ]}>
              <View style={styles.editCommentHeader}>
                <Text style={styles.editCommentTitle}>Edit Comment</Text>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={cancelEditComment}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.editCommentInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
                placeholder="Edit your comment..."
                placeholderTextColor="#999"
              />
              <View style={styles.editCommentActions}>
                <TouchableOpacity
                  style={styles.cancelEditActionButton}
                  onPress={cancelEditComment}
                >
                  <Text style={styles.cancelEditActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveEditActionButton,
                    !editText.trim() && styles.saveEditActionButtonDisabled,
                  ]}
                  onPress={() => saveEditedComment(selectedPost.id, editingComment.id)}
                  disabled={!editText.trim()}
                >
                  <Text style={styles.saveEditActionText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {currentUser && !editingComment && (
            <View style={[
              styles.commentInputContainer,
              { bottom: keyboardHeight }
            ]}>
              {renderUserAvatar(currentUser.uid, null, 36)}
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#999"
                value={commentTexts[selectedPost?.id] || ""}
                onChangeText={(text) =>
                  setCommentTexts((prev) => ({
                    ...prev,
                    [selectedPost.id]: text,
                  }))
                }
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !commentTexts[selectedPost?.id]?.trim() &&
                    styles.sendButtonDisabled,
                ]}
                onPress={() =>
                  addComment(selectedPost.id, selectedPost.commentsCount)
                }
                disabled={!commentTexts[selectedPost?.id]?.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={
                    commentTexts[selectedPost?.id]?.trim() ? "white" : "#ccc"
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ENHANCED: Likes Modal */}
      <Modal
        visible={likesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeLikesModal}
      >
        <TouchableOpacity 
          style={styles.likesModalContainer}
          activeOpacity={1}
          onPress={closeLikesModal}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.likesModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.likesModalHeader}>
              <View style={styles.likesModalHeaderLeft}>
                <Text style={styles.likesModalTitle}>
                  Reactions
                </Text>
                <Text style={styles.likesModalSubtitle}>
                  {selectedPostLikes.length} {selectedPostLikes.length === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.likesModalCloseButton}
                onPress={closeLikesModal}
              >
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={selectedPostLikes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.likeItem}>
                  {renderUserAvatar(item.userId, item.photoURL, 44)}
                  <View style={styles.likeUserInfo}>
                    <Text style={styles.likeUserName}>{item.authorName}</Text>
                    <Text style={styles.likeTime}>
                      {item.createdAt
                        ? formatTimeAgo(new Date(item.createdAt.seconds * 1000))
                        : ""}
                    </Text>
                  </View>
                  <Ionicons name="heart" size={20} color="#e74c3c" />
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.noLikes}>
                  <View style={styles.noLikesIconContainer}>
                    <Ionicons name="heart-outline" size={56} color="#e0e0e0" />
                  </View>
                  <Text style={styles.noLikesText}>No reactions yet</Text>
                  <Text style={styles.noLikesSubtext}>
                    Be the first to react to this post
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.likesListContainer}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle" size={22} color="#fff" />
          <Text style={styles.footerText}>Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Ionicons name="home" size={22} color="#fff" />
          <Text style={styles.footerText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  wrapper: { 
    flex: 1, 
    backgroundColor: "#f8f9fa" 
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#555",
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  postContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  modalPostContainer: {
    margin: 0,
    marginBottom: 8,
    padding: 20,
    borderRadius: 0,
    backgroundColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    elevation: 0,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorName: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
    marginBottom: 2,
  },
  postTime: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: "#e1f5fe",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
  },
  postContent: {
    marginBottom: 10,
  },
  postContentText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  imageContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f8f8f8",
  },
  postImage: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  imageLoader: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  imageError: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginTop: 10,
  },
  imageErrorText: {
    marginTop: 8,
    color: "#888",
    fontSize: 14,
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  postStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
    marginVertical: 8,
  },
  statButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactIconsContainer: {
    flexDirection: 'row',
    marginRight: 6,
  },
  reactIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statText: {
    fontSize: 13,
    color: "#666",
  },
  likesCount: {
    color: "#007AFF",
    fontWeight: '600',
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 5,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  activeActionButton: {
    backgroundColor: "#ffebee",
  },
  actionIconContainer: {
    marginRight: 2,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#555",
    fontWeight: "600",
  },
  activeActionText: {
    color: "#e74c3c",
  },
  commentAvatar: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  commentCountHeader: {
    fontSize: 13,
    color: '#65676b',
    marginTop: 4,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: 120,
  },
  commentsSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
  },
  commentsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  noComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noCommentsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  adminCommentItem: {
    backgroundColor: '#fff4e6',
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  commentContent: {
    flex: 1,
    marginLeft: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  commentAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1a1a1a',
    marginRight: 6,
  },
  adminAuthor: {
    color: '#e67e22',
  },
  adminBadge: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  commentMenuButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  commentText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 20,
    marginTop: 0,
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 12,
    color: '#65676b',
    marginTop: 0,
  },
  commentMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentMenuModal: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  commentMenuContent: {
    backgroundColor: 'white',
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  commentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  commentMenuDivider: {
    height: 0.5,
    backgroundColor: '#e8eaed',
    marginHorizontal: 16,
  },
  deleteMenuItem: {
    // No additional styles needed
  },
  commentMenuItemText: {
    fontSize: 17,
    color: '#1a1a1a',
    fontWeight: '400',
  },
  deleteMenuItemText: {
    color: '#e74c3c',
  },
  commentMenuCancel: {
    backgroundColor: 'white',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  commentMenuCancelText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  likesModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  likesModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '40%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  likesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  likesModalHeaderLeft: {
    flex: 1,
  },
  likesModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  likesModalSubtitle: {
    fontSize: 14,
    color: '#65676b',
    marginTop: 2,
    fontWeight: '500',
  },
  likesModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likesListContainer: {
    paddingVertical: 8,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  likeUserInfo: {
    marginLeft: 14,
    flex: 1,
  },
  likeUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  likeTime: {
    fontSize: 13,
    color: '#65676b',
  },
  noLikes: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noLikesIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noLikesText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  noLikesSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  editCommentContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  editCommentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editCommentTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  cancelEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCommentInput: {
    borderWidth: 1,
    borderColor: '#e8eaed',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f8f9fa',
    color: '#1a1a1a',
  },
  editCommentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  cancelEditActionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f0f2f5',
  },
  cancelEditActionText: {
    color: '#65676b',
    fontSize: 15,
    fontWeight: '600',
  },
  saveEditActionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveEditActionButtonDisabled: {
    backgroundColor: '#e8eaed',
    shadowOpacity: 0,
  },
  saveEditActionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  commentInputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
    backgroundColor: '#fff',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8eaed',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
    color: '#1a1a1a',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#e8eaed',
    shadowOpacity: 0,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#004d40",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerButton: {
    alignItems: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
});