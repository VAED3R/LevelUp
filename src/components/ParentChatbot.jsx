import React, { useState } from 'react';
import styles from './ParentChatbot.module.css';
import { FaRobot, FaTimes, FaGraduationCap, FaHandHoldingHeart } from 'react-icons/fa';

const ParentChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatMessage = (text) => {
    // Remove markdown symbols and format the text
    return text
      .replace(/\*\*\*/g, '') // Remove triple asterisks
      .replace(/\*\*/g, '') // Remove double asterisks
      .replace(/\*/g, '') // Remove single asterisks
      .replace(/\#\#\#/g, '') // Remove triple hashes
      .replace(/\#\#/g, '') // Remove double hashes
      .replace(/\#/g, '') // Remove single hashes
      .replace(/\-\s/g, '• ') // Convert dashes to bullets
      .replace(/\n/g, '<br />') // Convert newlines to HTML breaks
      .replace(/\`/g, ''); // Remove backticks
  };

  const handleChatbotClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setActiveChat(null);
      setMessages([]);
    }
  };

  const handleOptionClick = (option) => {
    setActiveChat(option);
    const initialMessage = option === 'counseling' 
      ? "Hello! I'm here to help with counseling. Could you please tell me what specific concerns you have about your child?"
      : "Hello! I'm here to help with career guidance. Could you tell me what grade your child is in and what subjects they enjoy?";
    
    setMessages([{
      type: 'bot',
      text: initialMessage
    }]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = {
      type: 'user',
      text: inputMessage
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Prepare the context based on the active chat type
      const context = activeChat === 'counseling'
        ? "You are a counseling assistant helping parents with their children's issues. Be empathetic and provide practical advice. Focus on understanding the parent's concerns and offering supportive guidance. Keep responses concise and avoid using markdown formatting."
        : "You are a career guidance assistant helping parents understand career options for their children. Provide relevant information about educational paths and career opportunities based on the child's interests and abilities. Keep responses concise and avoid using markdown formatting.";

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: context
            },
            {
              role: 'user',
              content: inputMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      const formattedText = formatMessage(data.choices[0].message.content);
      const botResponse = {
        type: 'bot',
        text: formattedText
      };

      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error getting response:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        text: "I'm sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.chatbotContainer}>
      <button 
        className={styles.chatbotButton}
        onClick={handleChatbotClick}
      >
        <FaRobot className={styles.chatbotIcon} />
      </button>

      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <h3>Parent Assistant</h3>
            <button 
              className={styles.closeButton}
              onClick={handleChatbotClick}
            >
              <FaTimes />
            </button>
          </div>

          {!activeChat ? (
            <div className={styles.optionsContainer}>
              <button 
                className={styles.optionButton}
                onClick={() => handleOptionClick('counseling')}
              >
                <FaHandHoldingHeart className={styles.optionIcon} />
                Counseling
              </button>
              <button 
                className={styles.optionButton}
                onClick={() => handleOptionClick('career')}
              >
                <FaGraduationCap className={styles.optionIcon} />
                Career Guidance
              </button>
            </div>
          ) : (
            <div className={styles.chatContent}>
              <div className={styles.messagesContainer}>
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`${styles.message} ${message.type === 'user' ? styles.userMessage : styles.botMessage}`}
                    dangerouslySetInnerHTML={{ __html: message.text }}
                  />
                ))}
                {isLoading && (
                  <div className={`${styles.message} ${styles.botMessage}`}>
                    Thinking...
                  </div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className={styles.inputContainer}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className={styles.messageInput}
                  disabled={isLoading}
                />
                <button 
                  type="submit" 
                  className={styles.sendButton}
                  disabled={isLoading}
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ParentChatbot; 