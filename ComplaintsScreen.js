// ComplaintsScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

export default function ComplaintsScreen({ navigation }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "complaints"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setComplaints(list);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleFileOpen = async (url, fileName) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", `Cannot open file: ${fileName}`);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
      Alert.alert("Error", "Failed to open file");
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#ff9500';
      case 'resolved':
        return '#34c759';
      case 'in-progress':
        return '#007aff';
      default:
        return '#8e8e93';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'time-outline';
      case 'resolved':
        return 'checkmark-circle-outline';
      case 'in-progress':
        return 'refresh-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const isImageFile = (url, fileName) => {
    const imageExtensions = /\.(jpeg|jpg|png|gif|webp|bmp)$/i;
    return imageExtensions.test(fileName || url);
  };

  const getFileIcon = (fileName, fileType) => {
    if (isImageFile('', fileName)) return 'image-outline';
    if (fileName?.includes('.pdf')) return 'document-text-outline';
    if (fileName?.includes('.doc')) return 'document-outline';
    if (fileName?.includes('.xls')) return 'grid-outline';
    return 'document-outline';
  };

  const formatFileSize = (size) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderAttachment = (attachment, index) => {
    const isImage = isImageFile(attachment.url, attachment.name);
    
    return (
      <TouchableOpacity
        key={index}
        style={styles.attachmentContainer}
        onPress={() => handleFileOpen(attachment.url, attachment.name)}
      >
        {isImage ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: attachment.url }} 
              style={styles.attachmentImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay}>
              <Ionicons name="expand-outline" size={20} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.fileContainer}>
            <Ionicons 
              name={getFileIcon(attachment.name, attachment.type)} 
              size={40} 
              color="#007AFF" 
            />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>
                {attachment.name || 'Unknown file'}
              </Text>
              {attachment.size && (
                <Text style={styles.fileSize}>
                  {formatFileSize(attachment.size)}
                </Text>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.complaintCard}>
      {/* Header */}
      <View style={styles.complaintHeader}>
        <View style={styles.statusContainer}>
          <Ionicons 
            name={getStatusIcon(item.status)} 
            size={16} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {(item.status || 'unknown').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.dateText}>
          {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'No date'}
        </Text>
      </View>

      {/* Personal Info */}
      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Name:</Text>
        <Text style={styles.infoValue}>{item.name || 'N/A'}</Text>
      </View>
      
      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Contact:</Text>
        <Text style={styles.infoValue}>{item.contactNo || 'N/A'}</Text>
      </View>
      
      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Address:</Text>
        <Text style={styles.infoValue}>{item.address || 'N/A'}</Text>
      </View>

      {/* Complaint Text */}
      <View style={styles.complaintSection}>
        <Text style={styles.complaintLabel}>Complaint:</Text>
        <Text style={styles.complaintText}>{item.complaint}</Text>
      </View>

      {/* Attachments */}
      {item.attachments && item.attachments.length > 0 && (
        <View style={styles.attachmentsSection}>
          <Text style={styles.attachmentsLabel}>
            Attachments ({item.attachments.length})
          </Text>
          <View style={styles.attachmentsList}>
            {item.attachments.map((attachment, index) => 
              renderAttachment(attachment, index)
            )}
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading complaints...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>My Complaints</Text>
      
      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>No complaints yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to file your first complaint
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("FileComplaint")}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

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
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.replace("Login")}
        >
          <Ionicons name="log-out" size={22} color="#fff" />
          <Text style={styles.footerText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { 
    flex: 1, 
    backgroundColor: "#f8f9fa" 
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    paddingVertical: 15,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  complaintCard: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  complaintHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#666",
  },
  infoSection: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    width: 70,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  complaintSection: {
    marginTop: 12,
    marginBottom: 16,
  },
  complaintLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  complaintText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  attachmentsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  attachmentsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  attachmentsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attachmentContainer: {
    marginBottom: 8,
  },
  imageContainer: {
    position: "relative",
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imageOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 4,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9ff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    width: 160,
  },
  fileInfo: {
    marginLeft: 8,
    flex: 1,
  },
  fileName: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  fileSize: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  fab: {
    position: "absolute",
    bottom: 80,
    right: 20,
    backgroundColor: "#007AFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 8,
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