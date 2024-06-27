import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import xml2js from 'react-native-xml2js';
import createSharedAccessToken from './getSasToken';

export default function App() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registrationId, setRegistrationId] = useState(null);
  const [azureTags, setAzureTags] = useState([]);

  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status (enabled):', authStatus);
    } else {
      console.log('Authorization status:', authStatus);
    }
    return enabled;
  };

  const subscribeToNotifications = async () => {
    const permissionGranted = await requestUserPermission();
    if (permissionGranted) {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);

      const registrationData = `
      <entry xmlns="http://www.w3.org/2005/Atom">
      <content type="application/xml">
          <FcmV1RegistrationDescription xmlns:i="http://www.w3.org/2001/XMLSchema-instance"
              xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect">
              <Tags>myTag,myOtherTag</Tags>
              <FcmV1RegistrationId>${token}</FcmV1RegistrationId>
          </FcmV1RegistrationDescription>
      </content>
  </entry> 
      `;

      const uri = 'https://pushDemoErp.servicebus.windows.net/pushDemoErp/registrations/?api-version=2015-01';
      const saName = 'DefaultFullSharedAccessSignature';
      const saKey = 'pS9rpD+hkk/v0kWKkVH66ayJpsSM2CP0Aqq4gLap+wY=';

      const sasToken = createSharedAccessToken(uri, saName, saKey);
      console.log('SAS Token:', sasToken);

      try {
        const response = await axios.post(uri, registrationData, {
          headers: {
            'Authorization': sasToken,
            'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
            'x-ms-version': '2015-01'
          }
        });
        console.log('Registration response:', response.data);

        // Extract registration ID from the response if possible
        xml2js.parseString(response.data, (err, result) => {
          if (err) {
            console.error('Error parsing registration response:', err);
            return;
          }
          const registrationId = result.entry.content[0].FcmV1RegistrationDescription[0].RegistrationId[0];
          const tags = result.entry.content[0].FcmV1RegistrationDescription[0].Tags[0];
          setRegistrationId(registrationId);
          setAzureTags(tags);
          console.log(registrationId)
          console.log(azureTags)
          setIsSubscribed(true);
        });
      } catch (error) {
        console.error('Error registering token with Azure:', error.response?.data || error.message);
      }
    } else {
      console.error('Permission not granted');
    }
  };

  const unsubscribeFromNotifications = async () => {
    if (!registrationId) {
      console.error('No registration ID found');
      return;
    }

    const uri = `https://pushDemoErp.servicebus.windows.net/pushDemoErp/registrations/${registrationId}?api-version=2015-01`;
    const saName = 'DefaultFullSharedAccessSignature';
    const saKey = 'pS9rpD+hkk/v0kWKkVH66ayJpsSM2CP0Aqq4gLap+wY=';

    const sasToken = createSharedAccessToken(uri, saName, saKey);
    console.log('SAS Token:', sasToken);

    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts += 1;
      try {
        const response = await axios.delete(uri, {
          headers: {
            'Authorization': sasToken,
            'If-Match': '*',
            'x-ms-version': '2015-01'
          }
        });
        console.log('Unsubscribe response:', response.data);
        if (response.status === 200 || response.status === 204) {
          success = true;
          setIsSubscribed(false);
          setRegistrationId(null);
          console.log('Successfully unsubscribed from notifications.');
        } else {
          console.error(`Unexpected response status: ${response.status}`);
        }
      } catch (error) {
        console.error('Error unregistering token with Azure:', error.response?.data || error.message);
        if (attempts >= maxAttempts) {
          console.error('Max unsubscribe attempts reached.');
        } else {
          console.log(`Retrying unsubscribe attempt ${attempts}...`);
        }
      }
    }
  };

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            sound: true,
          });
        }

        const handlePushNotification = async (remoteMessage) => {
          const notification = {
            title: remoteMessage.notification?.title || 'No Title',
            body: remoteMessage.notification?.body || 'No Body',
            data: remoteMessage.data,
          };

          await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: { seconds: 5 },
          });
        };

        const unsubscribe = messaging().onMessage(handlePushNotification);

        const handleNotificationClick = async (response) => {
          const screen = response?.notification?.request?.content?.data?.screen;
          if (screen !== null) {
            // Add navigation logic here if needed
          }
        };

        const notificationClickSubscription = Notifications.addNotificationResponseReceivedListener(handleNotificationClick);

        messaging().setBackgroundMessageHandler(async (remoteMessage) => {
          const notification = {
            title: remoteMessage.notification?.title || 'No Title',
            body: remoteMessage.notification?.body || 'No Body',
            data: remoteMessage.data,
          };

          await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null,
          });
        });

        return () => {
          unsubscribe();
          notificationClickSubscription.remove();
        };
      } catch (error) {
        console.error('Error initializing notifications:', error.message);
      }
    };

    initializeNotifications();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <Button
        title={isSubscribed ? "Unsubscribe from Notifications" : "Subscribe to Notifications"}
        onPress={isSubscribed ? unsubscribeFromNotifications : subscribeToNotifications}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
