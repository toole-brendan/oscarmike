import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';
import { apiRequestObject } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

// Extend the user schema to add password confirmation
const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
    },
  });
  
  const registerMutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      // Remove confirmPassword as it's not part of the API schema
      const { confirmPassword, ...userData } = values;
      return apiRequestObject({
        url: '/api/users',
        method: 'POST',
        body: userData,
        on401: 'throw'
      });
    },
    onSuccess: async () => {
      toast({
        title: 'Registration successful',
        description: 'Your account has been created. Please log in.',
        variant: 'default',
      });
      navigate('/login');
    },
    onError: (error) => {
      toast({
        title: 'Registration failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });
  
  const onSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate(values);
  };
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md p-8 shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold tracking-tight">OMPT</h1>
          <p className="text-xs text-gray-600 mt-1 font-normal tracking-normal">On The Move Physical Training</p>
          <p className="text-gray-600 mt-6">
            Create an account to track your workout progress
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Confirm password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-blue-600"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Registering...' : 'Register'}
            </Button>
            
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button 
                  type="button"
                  className="text-primary hover:underline" 
                  onClick={() => navigate('/login')}
                >
                  Log in
                </button>
              </p>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default Register;